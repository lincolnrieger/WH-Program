import { useCallback, useMemo, useState } from 'react'
import type { Activity, Site } from '@/types'
import { SITES } from '@/types'
import { parseWorkbooks, type ImportResult } from '@/lib/importItinerary'
import { readWorkbook, readZip } from '@/lib/xlsxRead'
import { formatDate } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button, Select, cx } from '@/components/ui/primitives'

/**
 * Brings the old itinerary workbooks in.
 *
 * Nothing is written until the preview has been seen: the sheets are
 * hand-maintained and this is a one-way trip into the shared plan, so what came
 * out of them — every stay, every session count, every name the catalogue
 * didn't recognise — is on screen before the button that commits it.
 */
export function ImportDialog({
  site,
  catalogue,
  onImport,
  onClose,
}: {
  site: Site
  catalogue: Activity[]
  onImport: (result: ImportResult, options: { addUnknownActivities: boolean }) => void
  onClose: () => void
}) {
  const [targetSite, setTargetSite] = useState<Site>(site)
  const [addUnknown, setAddUnknown] = useState(true)
  const [files, setFiles] = useState<{ name: string; sheets: ReturnType<typeof readWorkbook> }[]>([])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

  const result = useMemo(
    () =>
      files.length > 0
        ? parseWorkbooks(files, catalogue, { site: targetSite, addUnknownActivities: addUnknown })
        : null,
    [files, catalogue, targetSite, addUnknown],
  )

  const sessionCount = useMemo(
    () => result?.bookings.reduce((total, entry) => total + entry.blocks.length, 0) ?? 0,
    [result],
  )

  const accept = useCallback(async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return
    setReading(true)
    setError(null)

    const read: { name: string; sheets: ReturnType<typeof readWorkbook> }[] = []
    const failed: string[] = []

    for (const file of Array.from(picked)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (/\.zip$/i.test(file.name)) {
          const inside = readZip(bytes)
          if (inside.length === 0) failed.push(`${file.name} (no spreadsheets in it)`)
          read.push(...inside)
        } else if (/\.xlsx$/i.test(file.name)) {
          read.push({ name: file.name, sheets: readWorkbook(bytes) })
        } else {
          failed.push(`${file.name} (not a .xlsx or .zip)`)
        }
      } catch {
        failed.push(`${file.name} (couldn't be opened)`)
      }
    }

    setFiles((current) => {
      // Re-picking the same file replaces it rather than doubling it up.
      const byName = new Map(current.map((entry) => [entry.name, entry]))
      for (const entry of read) byName.set(entry.name, entry)
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    })
    setSkipped(failed)
    setReading(false)
  }, [])

  return (
    <Modal
      title="Import from spreadsheets"
      description="Holistic weeks and individual school itineraries, as .xlsx or a .zip of them"
      width={760}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {files.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setFiles([])
                setSkipped([])
              }}
            >
              Clear
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!result || result.bookings.length === 0}
            onClick={() => {
              if (!result) return
              onImport(result, { addUnknownActivities: addUnknown })
              onClose()
            }}
          >
            {result && result.bookings.length > 0
              ? `Add ${result.bookings.length} school${result.bookings.length === 1 ? '' : 's'}`
              : 'Add to the plan'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label
          className={cx(
            'flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
            'border-[var(--line-strong)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]',
          )}
        >
          <input
            type="file"
            accept=".xlsx,.zip"
            multiple
            className="sr-only"
            onChange={(event) => {
              void accept(event.target.files)
              event.target.value = ''
            }}
          />
          <span className="text-[13px] font-semibold text-[var(--ink)]">
            {reading ? 'Reading…' : 'Choose spreadsheets or a zip'}
          </span>
          <span className="text-[11.5px] text-[var(--ink-soft)]">
            A week folder zipped up works — the holistic sheet and the schools' own
            itineraries are reconciled rather than imported twice.
          </span>
        </label>

        {error && <Problem>{error}</Problem>}
        {skipped.length > 0 && <Problem>Skipped: {skipped.join(', ')}</Problem>}

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
                  Import as
                </span>
                <Select
                  value={targetSite}
                  onChange={(event) => setTargetSite(event.target.value as Site)}
                >
                  {SITES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex cursor-pointer items-start gap-2 pt-5 text-[12.5px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={addUnknown}
                  onChange={(event) => setAddUnknown(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--brand)]"
                />
                <span>
                  Add activities the catalogue doesn’t have
                  <span className="block text-[11px] text-[var(--ink-soft)]">
                    Each keeps the colour it had in the spreadsheet.
                  </span>
                </span>
              </label>
            </div>

            <Section label={`Files read (${result.files.length})`}>
              <ul className="space-y-0.5">
                {result.files.map((file) => (
                  <li key={file.name} className="flex items-baseline gap-2 text-[11.5px]">
                    <span
                      className={cx(
                        'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium',
                        file.layout === 'none'
                          ? 'bg-[var(--warn-tint)] text-[var(--warn)]'
                          : 'bg-[var(--surface-sunk)] text-[var(--ink-faint)]',
                      )}
                    >
                      {file.layout === 'none' ? 'nothing found' : file.layout}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{file.name}</span>
                    {file.schools > 0 && (
                      <span className="tnum shrink-0 text-[var(--ink-faint)]">
                        {file.schools} school{file.schools === 1 ? '' : 's'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              label={`Stays found (${result.bookings.length}) · ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
            >
              {result.bookings.length === 0 ? (
                <p className="text-[12px] text-[var(--ink-soft)]">
                  Nothing recognisable in those files. They should be the holistic week sheet or a
                  school’s own itinerary, laid out with the times down the left.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border border-[var(--line)]">
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead className="sticky top-0 bg-[var(--surface-sunk)]">
                      <tr className="text-left text-[var(--ink-faint)]">
                        <th className="px-2 py-1 font-medium">School</th>
                        <th className="px-2 py-1 font-medium">Dates</th>
                        <th className="px-2 py-1 text-right font-medium">Groups</th>
                        <th className="px-2 py-1 text-right font-medium">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bookings.map(({ booking, blocks }) => (
                        <tr key={booking.id} className="border-t border-[var(--line)]">
                          <td className="px-2 py-1">
                            <span className="block font-medium text-[var(--ink)]">
                              {booking.schoolName}
                            </span>
                            <span className="block text-[10.5px] text-[var(--ink-faint)]">
                              {[booking.yearLevel, booking.building].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </td>
                          <td className="tnum px-2 py-1 whitespace-nowrap text-[var(--ink-soft)]">
                            {formatDate(booking.startDate)}
                            {booking.endDate !== booking.startDate && ` – ${formatDate(booking.endDate)}`}
                          </td>
                          <td className="tnum px-2 py-1 text-right text-[var(--ink-soft)]">
                            {booking.groups.length}
                          </td>
                          <td className="tnum px-2 py-1 text-right text-[var(--ink-soft)]">
                            {blocks.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {addUnknown && result.newActivities.length > 0 && (
              <Section label={`New activities (${result.newActivities.length})`}>
                <div className="flex flex-wrap gap-1">
                  {result.newActivities.map((activity) => (
                    <span
                      key={activity.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: activity.colour }}
                      />
                      {activity.name}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {result.warnings.length > 0 && (
              <Section label={`Worth a look (${result.warnings.length})`}>
                <ul className="space-y-0.5">
                  {result.warnings.map((warning) => (
                    <li key={warning} className="text-[11.5px] text-[var(--warn)]">
                      {warning}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <p className="rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11px] leading-snug text-[var(--ink-soft)]">
              These are added alongside whatever is already in the plan — nothing is replaced. It
              lands as one step, so <strong>Ctrl+Z</strong> takes the whole import back out.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-[var(--danger-tint)] px-2 py-1.5 text-[11.5px] text-[var(--danger)]">
      {children}
    </p>
  )
}
