import type { ProgramDocument } from '@/types'
import { DOCUMENT_VERSION, EMPTY_OVERRIDES } from '@/types'
import { downloadFile, safeName } from './exportImport'

/**
 * A whole-plan backup, as one file.
 *
 * There is only ever one plan and it lives in the database, so this isn't a
 * document format — nothing opens a backup to work on it. It exists so that a
 * mistake big enough to want undoing after the fact can be undone: download a
 * copy now and then, and the worst case is losing the work since.
 */

interface BackupFile {
  kind: 'wh-program-backup'
  version: number
  savedAt: string
  document: ProgramDocument
}

export function exportBackup(doc: ProgramDocument): void {
  const backup: BackupFile = {
    kind: 'wh-program-backup',
    version: DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    document: doc,
  }
  downloadFile(
    `${safeName('wh-program-backup')}-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    'application/json',
  )
}

/**
 * Reads a backup file back into a document.
 *
 * Deliberately strict about the shape, and deliberately forgiving about the
 * version: an older backup is missing fields rather than wrong, so the gaps get
 * filled instead of the file being rejected.
 */
export async function readBackup(file: File): Promise<ProgramDocument> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a plan backup — it isn't valid JSON.")
  }

  const wrapper = parsed as Partial<BackupFile>
  const raw = (wrapper?.kind === 'wh-program-backup' ? wrapper.document : parsed) as
    | Partial<ProgramDocument>
    | undefined

  if (!raw || !Array.isArray(raw.bookings) || !Array.isArray(raw.blocks)) {
    throw new Error("That file isn't a plan backup — it has no schools or sessions in it.")
  }

  return {
    version: DOCUMENT_VERSION,
    site: raw.site ?? 'woodhouse',
    bookings: raw.bookings,
    blocks: raw.blocks,
    customActivities: raw.customActivities ?? [],
    customVenues: raw.customVenues ?? [],
    customStaff: raw.customStaff ?? [],
    overrides: { ...EMPTY_OVERRIDES, ...(raw.overrides ?? {}) },
    updatedAt: new Date().toISOString(),
  }
}

/** Opens a file picker and resolves with the chosen file, or null if cancelled. */
export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    // A cancelled picker fires no `change` event in some browsers; `cancel`
    // covers the ones that support it and the promise is simply dropped
    // elsewhere, which does nothing.
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
