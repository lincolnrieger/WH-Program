/**
 * Keeps the in-memory plan and the D1 database in step.
 *
 * The app edits whole `ProgramDocument`s — that is what undo snapshots and what
 * every view reads. Saving, though, happens row by row: each commit is diffed
 * against the one before it and only the rows that actually changed are sent.
 * Two people planning different schools therefore don't overwrite each other,
 * which a whole-document save would guarantee they did.
 *
 * If the network is down the app keeps working. Outstanding changes queue up in
 * this browser and go out when it comes back, so a dropped connection costs you
 * nothing but the sync badge turning grey.
 */

import type { ProgramDocument } from '@/types'
import { EMPTY_OVERRIDES } from '@/types'
import { ApiError, fetchRevision, fetchState, pushOps, type Op, type RemoteState } from '@/lib/api'
import { hasAdoptedDatabase, loadQueue, markDatabaseAdopted, saveQueue } from './persist'

/** How long to gather edits before sending them. One drag is many commits. */
const DEBOUNCE_MS = 500
/** How often to ask whether someone else has changed something. */
const POLL_MS = 10_000
/** Backoff ceiling once the server has stopped answering. */
const MAX_RETRY_MS = 30_000

export type SyncStatus =
  /** Reading the plan for the first time. */
  | 'loading'
  /** Everything sent and acknowledged. */
  | 'synced'
  /** Changes in flight or waiting to go. */
  | 'saving'
  /** Can't reach the database; edits are queued in this browser. */
  | 'offline'
  /** The database answered, but with an error worth showing. */
  | 'error'

export interface SyncState {
  status: SyncStatus
  /** Set when status is 'error' or 'offline'. */
  message?: string
  /** Changes waiting to go out. */
  pending: number
  lastSyncedAt?: string
}

type Listener = (state: SyncState) => void

let state: SyncState = { status: 'loading', pending: 0 }
const listeners = new Set<Listener>()

/** Ops that have been made locally and not yet acknowledged by the database. */
let queue: Op[] = loadQueue()
let revision = 0
let flushTimer: number | undefined
let retryMs = 1000
let flushing = false
/** Set while we're applying the server's state, so it isn't echoed back up. */
let hydrating = false

function publish(patch: Partial<SyncState>): void {
  state = { ...state, ...patch, pending: queue.length }
  for (const listener of listeners) listener(state)
}

export function subscribeToSync(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export function syncState(): SyncState {
  return state
}

/** True while the store is applying remote state and must not re-queue it. */
export function isHydrating(): boolean {
  return hydrating
}

// ─── diffing ────────────────────────────────────────────────────────────────

function index<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

/**
 * Compares two documents and returns the rows that changed.
 *
 * Equality is by JSON, which is exact for this data — every value in a booking
 * or a block is a string, number, boolean or array of those — and much cheaper
 * than the alternative of writing every row on every keystroke.
 */
export function diffDocuments(before: ProgramDocument, after: ProgramDocument): Op[] {
  const ops: Op[] = []

  const oldBookings = index(before.bookings)
  for (const booking of after.bookings) {
    const previous = oldBookings.get(booking.id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(booking)) {
      ops.push({ type: 'booking.put', booking })
    }
    oldBookings.delete(booking.id)
  }
  for (const id of oldBookings.keys()) ops.push({ type: 'booking.delete', id })

  const oldBlocks = index(before.blocks)
  for (const block of after.blocks) {
    const previous = oldBlocks.get(block.id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(block)) {
      ops.push({ type: 'block.put', block })
    }
    oldBlocks.delete(block.id)
  }
  for (const id of oldBlocks.keys()) ops.push({ type: 'block.delete', id })

  ops.push(
    ...diffCatalogue('activity', before.customActivities, after.customActivities),
    ...diffCatalogue('venue', before.customVenues, after.customVenues),
    ...diffCatalogue('staff', before.customStaff, after.customStaff),
  )

  if (JSON.stringify(before.overrides) !== JSON.stringify(after.overrides)) {
    ops.push({ type: 'overrides.put', overrides: after.overrides ?? EMPTY_OVERRIDES })
  }

  return ops
}

function diffCatalogue<T extends { id: string }>(
  kind: 'activity' | 'venue' | 'staff',
  before: T[] = [],
  after: T[] = [],
): Op[] {
  const ops: Op[] = []
  const old = index(before)
  for (const record of after) {
    const previous = old.get(record.id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(record)) {
      ops.push({ type: 'catalogue.put', kind, id: record.id, data: record })
    }
    old.delete(record.id)
  }
  for (const id of old.keys()) ops.push({ type: 'catalogue.delete', kind, id })
  return ops
}

/** Every row of a document, for pushing a whole plan up at once. */
export function documentToOps(doc: ProgramDocument): Op[] {
  return diffDocuments(emptyDocument(doc), doc)
}

function emptyDocument(like: ProgramDocument): ProgramDocument {
  return {
    ...like,
    bookings: [],
    blocks: [],
    customActivities: [],
    customVenues: [],
    customStaff: [],
    overrides: structuredClone(EMPTY_OVERRIDES),
  }
}

// ─── queueing ───────────────────────────────────────────────────────────────

/**
 * Records a change. Repeated edits to one row collapse to the last one, so
 * dragging a block across the grid sends one row rather than forty.
 */
export function enqueue(ops: Op[]): void {
  if (ops.length === 0 || hydrating) return

  for (const op of ops) {
    const key = opKey(op)
    const existing = queue.findIndex((other) => opKey(other) === key)
    if (existing >= 0) queue.splice(existing, 1)
    queue.push(op)
  }

  saveQueue(queue)
  publish({ status: state.status === 'offline' ? 'offline' : 'saving' })
  scheduleFlush(DEBOUNCE_MS)
}

/** Identifies the row an op touches, so supersed3d ops can be dropped. */
function opKey(op: Op): string {
  switch (op.type) {
    case 'booking.put':
      return `booking:${op.booking.id}`
    case 'booking.delete':
      return `booking:${op.id}`
    case 'block.put':
      return `block:${op.block.id}`
    case 'block.delete':
      return `block:${op.id}`
    case 'catalogue.put':
    case 'catalogue.delete':
      return `catalogue:${op.kind}:${op.id}`
    case 'overrides.put':
      return 'overrides'
  }
}

function scheduleFlush(delay: number): void {
  if (flushTimer !== undefined) window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined
    void flush()
  }, delay)
}

async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return
  flushing = true

  const sending = queue
  queue = []

  try {
    const result = await pushOps(sending)
    revision = result.revision
    saveQueue(queue)
    retryMs = 1000
    publish({
      status: queue.length > 0 ? 'saving' : 'synced',
      message: undefined,
      lastSyncedAt: new Date().toISOString(),
    })
  } catch (error) {
    // Put the work back at the front — nothing has been saved.
    queue = [...sending, ...queue]
    saveQueue(queue)

    const offline = error instanceof ApiError && error.status === 0
    publish({
      status: offline ? 'offline' : 'error',
      message: error instanceof Error ? error.message : 'Could not save.',
    })

    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
    scheduleFlush(retryMs)
  } finally {
    flushing = false
    if (queue.length > 0 && flushTimer === undefined) scheduleFlush(DEBOUNCE_MS)
  }
}

/** Sends everything outstanding now, e.g. before the tab closes. */
export function flushNow(): Promise<void> {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer)
    flushTimer = undefined
  }
  return flush()
}

// ─── loading and polling ────────────────────────────────────────────────────

export interface SyncCallbacks {
  /** Called with whatever the database holds, at startup and on every change. */
  onRemoteState: (state: RemoteState) => void
  /**
   * This browser's cached plan, offered to the database only if the database is
   * empty *and* this browser has never synced before.
   */
  localFallback: () => ProgramDocument | null
}

let callbacks: SyncCallbacks | null = null
let started: Promise<void> | null = null

/**
 * Reads the plan and starts watching for other people's changes.
 *
 * If the database is empty but this browser has a plan saved from before the
 * database existed, that plan is pushed up rather than lost — which is what
 * happens to anyone upgrading from the version that only used local storage.
 *
 * Safe to call more than once: only the first call does anything, and the rest
 * wait on it. React's development mode deliberately runs effects twice, and two
 * of these racing would have the second one hydrate an empty plan over the
 * first one's upload.
 */
export function startSync(options: SyncCallbacks): Promise<void> {
  started ??= begin(options)
  return started
}

async function begin(options: SyncCallbacks): Promise<void> {
  callbacks = options
  publish({ status: 'loading' })

  try {
    const remote = await fetchState()
    revision = remote.revision

    const empty =
      remote.bookings.length === 0 &&
      remote.blocks.length === 0 &&
      remote.customActivities.length === 0

    // Only ever on this browser's very first run against a database: after
    // that an empty database means someone emptied it, not that it's new.
    if (empty && !hasAdoptedDatabase()) {
      const local = options.localFallback()
      if (local && local.bookings.length > 0) {
        markDatabaseAdopted()
        enqueue(documentToOps(local))
        await flushNow()
        publish({ status: queue.length > 0 ? 'saving' : 'synced' })
        startPolling()
        return
      }
    }

    markDatabaseAdopted()
    hydrate(remote)
    publish({ status: 'synced', message: undefined, lastSyncedAt: new Date().toISOString() })

    // Anything queued from a previous session goes out now.
    if (queue.length > 0) void flush()
  } catch (error) {
    const offline = error instanceof ApiError && error.status === 0
    publish({
      status: offline ? 'offline' : 'error',
      message: error instanceof Error ? error.message : 'Could not reach the database.',
    })
  }

  startPolling()
}

function hydrate(remote: RemoteState): void {
  if (!callbacks) return
  hydrating = true
  try {
    callbacks.onRemoteState(remote)
  } finally {
    hydrating = false
  }
}

let pollTimer: number | undefined

function startPolling(): void {
  if (pollTimer !== undefined) return
  pollTimer = window.setInterval(() => void poll(), POLL_MS)

  // Coming back to the tab is the moment you most want to be up to date.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void poll()
  })
  window.addEventListener('online', () => {
    void poll()
    if (queue.length > 0) void flush()
  })
}

/**
 * Picks up someone else's changes.
 *
 * Skipped while this browser has unsent work: pulling then would overwrite
 * edits that haven't been saved yet. They go out first, and the next poll
 * brings everything back together.
 */
async function poll(): Promise<void> {
  if (queue.length > 0 || flushing) return

  try {
    const { revision: latest } = await fetchRevision()
    if (latest === revision) {
      if (state.status === 'offline' || state.status === 'error') {
        publish({ status: 'synced', message: undefined })
      }
      return
    }

    const remote = await fetchState()
    // Someone may have saved while we were fetching; if so, leave it for the
    // next poll rather than dropping their work on top of ours.
    if (queue.length > 0) return

    revision = remote.revision
    hydrate(remote)
    publish({ status: 'synced', message: undefined, lastSyncedAt: new Date().toISOString() })
  } catch (error) {
    const offline = error instanceof ApiError && error.status === 0
    if (state.status !== 'saving') {
      publish({
        status: offline ? 'offline' : 'error',
        message: error instanceof Error ? error.message : 'Could not reach the database.',
      })
    }
  }
}

/** Forces a read, e.g. after loading the sample week or starting fresh. */
export async function refresh(): Promise<void> {
  try {
    const remote = await fetchState()
    revision = remote.revision
    hydrate(remote)
    publish({ status: 'synced', message: undefined, lastSyncedAt: new Date().toISOString() })
  } catch (error) {
    publish({
      status: error instanceof ApiError && error.status === 0 ? 'offline' : 'error',
      message: error instanceof Error ? error.message : 'Could not reach the database.',
    })
  }
}

/** Drops queued work — used when the plan is deliberately wiped. */
export function clearQueue(): void {
  queue = []
  saveQueue(queue)
  publish({})
}
