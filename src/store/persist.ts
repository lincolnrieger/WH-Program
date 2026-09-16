import type { ProgramDocument } from '@/types'
import { DOCUMENT_VERSION, EMPTY_OVERRIDES } from '@/types'
import type { Op } from '@/lib/api'

/**
 * Local storage, which since the move to D1 is a **cache**, not the record.
 *
 * It does two jobs. It lets the app paint the plan you had last time before the
 * database has answered, so opening it is instant rather than a spinner. And it
 * holds any changes that haven't reached the database yet, so closing the
 * laptop mid-edit on a bad connection doesn't lose them.
 */

const STORAGE_KEY = 'wh-program:document:v1'
const PREFS_KEY = 'wh-program:prefs:v1'
const QUEUE_KEY = 'wh-program:queue:v1'
const ADOPTED_KEY = 'wh-program:adopted:v1'

export interface Prefs {
  theme: 'light' | 'dark'
  snapMinutes: number
  zoom: number
  dayStartMin: number
  dayEndMin: number
  showConflicts: boolean
  /** Show venue and staff on blocks that are tall enough. */
  showBlockDetail: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  snapMinutes: 15,
  zoom: 1.1,
  dayStartMin: 7 * 60,
  dayEndMin: 21 * 60 + 30,
  showConflicts: true,
  showBlockDetail: true,
}

/**
 * Migrates a stored document forward. Older documents are upgraded field by
 * field rather than discarded — losing a week of planning to a schema bump
 * would be far worse than carrying a little migration code.
 */
function migrate(raw: unknown): ProgramDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Partial<ProgramDocument> & { version?: number }
  if (!Array.isArray(doc.bookings) || !Array.isArray(doc.blocks)) return null

  return {
    version: DOCUMENT_VERSION,
    site: doc.site ?? 'woodhouse',
    bookings: doc.bookings,
    blocks: doc.blocks.map((block) => ({
      ...block,
      // v1 stored a single groupId; v2 onwards stores an array.
      groupIds: Array.isArray(block.groupIds)
        ? block.groupIds
        : [(block as unknown as { groupId?: string }).groupId].filter(Boolean) as string[],
      staffIds: block.staffIds ?? [],
      delivery: block.delivery ?? 'staff',
      kind: block.kind ?? 'activity',
    })),
    customActivities: doc.customActivities ?? [],
    // v4 added in-app editing of activities, venues and staff.
    customVenues: doc.customVenues ?? [],
    customStaff: doc.customStaff ?? [],
    overrides: {
      ...EMPTY_OVERRIDES,
      ...(doc.overrides ?? {}),
      activities: doc.overrides?.activities ?? {},
      venues: doc.overrides?.venues ?? {},
      staff: doc.overrides?.staff ?? {},
      hiddenActivityIds: doc.overrides?.hiddenActivityIds ?? [],
      hiddenVenueIds: doc.overrides?.hiddenVenueIds ?? [],
      hiddenStaffIds: doc.overrides?.hiddenStaffIds ?? [],
    },
    updatedAt: doc.updatedAt ?? new Date().toISOString(),
  }
}

export function loadDocument(): ProgramDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveDocument(doc: ProgramDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // Storage full or blocked (private window) — the in-memory doc still works,
    // and the user can always export to a file.
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore — prefs are a convenience, not data
  }
}

/**
 * Whether this browser has ever talked to the database.
 *
 * It gates one thing: offering this browser's cached plan to an empty
 * database. That is how someone upgrading from the version that only had local
 * storage keeps their work — but only the first time. Without the flag, a
 * browser holding a stale cache would cheerfully re-upload a plan that someone
 * else had just deliberately cleared.
 */
export function hasAdoptedDatabase(): boolean {
  try {
    return localStorage.getItem(ADOPTED_KEY) === '1'
  } catch {
    return false
  }
}

export function markDatabaseAdopted(): void {
  try {
    localStorage.setItem(ADOPTED_KEY, '1')
  } catch {
    // Not being able to remember is the safe direction: the fallback only ever
    // fires against a database that is already completely empty.
  }
}

/**
 * Changes made but not yet accepted by the database.
 *
 * Kept on disk rather than only in memory so that a closed tab, a crash or a
 * flat battery during an outage costs nothing: the queue is picked up and sent
 * the next time the app opens with a connection.
 */
export function loadQueue(): Op[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Op[]) : []
  } catch {
    return []
  }
}

export function saveQueue(ops: Op[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch {
    // Storage full or blocked. The queue still lives in memory for this
    // session, so the only thing lost is surviving a reload while offline.
  }
}
