import type { ProgramDocument } from '@/types'
import { DOCUMENT_VERSION } from '@/types'

const STORAGE_KEY = 'wh-program:document:v1'
const PREFS_KEY = 'wh-program:prefs:v1'

export interface Prefs {
  theme: 'light' | 'dark'
  snapMinutes: number
  zoom: number
  dayStartMin: number
  dayEndMin: number
  showConflicts: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  snapMinutes: 15,
  zoom: 1.1,
  dayStartMin: 7 * 60,
  dayEndMin: 21 * 60 + 30,
  showConflicts: true,
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
    name: doc.name ?? 'Untitled week',
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
