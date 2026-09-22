import type { PrintOptions, PrintScope } from './PrintView'
import { formatDateLong, startOfWeek } from '@/lib/time'
import { termWeekOfWeek } from '@/lib/term'
import { Modal } from '@/components/ui/Modal'
import { Button, cx } from '@/components/ui/primitives'

export interface PrintCounts {
  booking: number
  siteDay: number
  siteWeek: number
}

/**
 * One question — what do you want — then print it or save it as a spreadsheet.
 *
 * There used to be options here for venues, the colour key and fitting to a
 * page. Every one of them had a right answer, so they are now just the answer.
 */
export function PrintDialog({
  options,
  onChange,
  onPrint,
  onExcel,
  onClose,
  bookingName,
  date,
  counts,
}: {
  options: PrintOptions
  onChange: (patch: Partial<PrintOptions>) => void
  onPrint: () => void
  onExcel: () => void
  onClose: () => void
  bookingName: string | undefined
  date: string
  counts: PrintCounts
}) {
  const week = termWeekOfWeek(startOfWeek(date))
  const school = bookingName ?? 'The selected school'

  const choices: { id: PrintScope; label: string; detail: string; count: number }[] = [
    {
      id: 'booking',
      label: `${school} — whole stay`,
      detail: 'The handout you give the school: every day, a column per group.',
      count: counts.booking,
    },
    {
      id: 'booking-day',
      label: `${school} — ${formatDateLong(date)}`,
      detail: 'Just this one day of the visit.',
      count: counts.booking,
    },
    {
      id: 'site-day',
      label: `Everyone on site — ${formatDateLong(date)}`,
      detail: 'Every school here that day, side by side on one page.',
      count: counts.siteDay,
    },
    {
      id: 'site-week',
      label: `Everyone on site — ${week.label}`,
      detail: 'The whole week, a band per day, on one page.',
      count: counts.siteWeek,
    },
  ]

  const empty = choices.find((choice) => choice.id === options.scope)?.count === 0

  return (
    <Modal
      title="Print or export"
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={empty} onClick={onExcel}>
            Save as Excel
          </Button>
          <Button variant="primary" disabled={empty} onClick={onPrint}>
            Print
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChange({ scope: choice.id })}
            disabled={choice.count === 0}
            className={cx(
              'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
              options.scope === choice.id
                ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                : 'border-[var(--line)] hover:bg-[var(--surface-sunk)]',
              choice.count === 0 && 'cursor-not-allowed opacity-40',
            )}
          >
            <span
              aria-hidden
              className={cx(
                'mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2',
                options.scope === choice.id ? 'border-[var(--brand)]' : 'border-[var(--line-strong)]',
              )}
            >
              {options.scope === choice.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                {choice.label}
              </span>
              <span className="block text-[11px] leading-snug text-[var(--ink-soft)]">
                {choice.detail}
              </span>
            </span>
          </button>
        ))}

        <p className="pt-1 text-[11px] leading-snug text-[var(--ink-faint)]">
          Printing? Turn on <strong className="font-medium">Background graphics</strong> so the
          activity colours come through. The Excel file keeps them either way.
        </p>
      </div>
    </Modal>
  )
}
