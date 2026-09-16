/**
 * The wire protocol between the app and its D1 database.
 *
 * The app keeps working with whole `ProgramDocument`s in memory — that's what
 * undo snapshots and every view reads — but it *saves* row by row. A change to
 * one session sends one row, so two people planning different schools at the
 * same time don't overwrite each other the way a whole-document save would.
 */

import type { Block, Booking, Overrides, Site } from '@/types'

export type CatalogueKind = 'activity' | 'venue' | 'staff'

/** A single row-level change. Ops are applied in order, in one transaction. */
export type Op =
  | { type: 'booking.put'; booking: Booking }
  | { type: 'booking.delete'; id: string }
  | { type: 'block.put'; block: Block }
  | { type: 'block.delete'; id: string }
  | { type: 'catalogue.put'; kind: CatalogueKind; id: string; data: unknown }
  | { type: 'catalogue.delete'; kind: CatalogueKind; id: string }
  | { type: 'overrides.put'; overrides: Overrides }

/** Everything in the database, as the app wants it. */
export interface RemoteState {
  /** Bumped on every write. The app polls it to notice someone else's changes. */
  revision: number
  bookings: Booking[]
  blocks: Block[]
  customActivities: unknown[]
  customVenues: unknown[]
  customStaff: unknown[]
  overrides: Overrides | null
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch (error) {
    // A network failure is not the same as the server saying no: the app stays
    // usable offline, so this has to be distinguishable from a real rejection.
    throw new ApiError(error instanceof Error ? error.message : 'Network error', 0)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ApiError(detail || `${response.status} ${response.statusText}`, response.status)
  }
  return (await response.json()) as T
}

export function fetchState(): Promise<RemoteState> {
  return request<RemoteState>('/api/state')
}

export function fetchRevision(): Promise<{ revision: number }> {
  return request<{ revision: number }>('/api/revision')
}

export function pushOps(ops: Op[]): Promise<{ revision: number }> {
  return request<{ revision: number }>('/api/mutate', {
    method: 'POST',
    body: JSON.stringify({ ops }),
  })
}

/** Wipes every booking, session and catalogue edit. Used by "Start fresh". */
export function resetAll(): Promise<{ revision: number }> {
  return request<{ revision: number }>('/api/reset', { method: 'POST' })
}

/** Whether the app is talking to a database at all. */
export interface Health {
  database: boolean
  bookings: number
}

export function fetchHealth(): Promise<Health> {
  return request<Health>('/api/health')
}

// ─── shaping ────────────────────────────────────────────────────────────────

/** Bookings for one site, which is all any one view ever needs. */
export function bookingsForSite(state: RemoteState, site: Site): Booking[] {
  return state.bookings.filter((booking) => booking.site === site)
}
