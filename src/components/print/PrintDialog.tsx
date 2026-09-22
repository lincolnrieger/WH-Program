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
 * One question — what do you want — and one button.
 *
 * The button opens the browser's own print window, which is where both a PDF
 * and a printed sheet come from; the paper size is already set for whichever
 * sheet was chosen, so there is nothing to get wrong there either.
 */
export function PrintDialog({
  options,
  onChange,
  onPrint,
  onClose,
  bookingName,
  date,
  counts,
}: {
  options: PrintOptions
  onChange: (patch: Partial<PrintOptions>) => void
  onPrint: () => void
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
      detail: 'The program you give the school: every day, a column per group. A4.',
      count: counts.booking,
    },
    {
      id: 'booking-day',
      label: `${school} — ${formatDateLong(date)}`,
      detail: 'Just this one day of the visit. A4.',
      count: counts.booking,
    },
    {
      id: 'site-day',
      label: `Everyone on site — ${formatDateLong(date)}`,
      detail: 'Every school here that day, side by side. Prints on A3.',
      count: counts.siteDay,
    },
    {
      id: 'site-week',
      label: `Everyone on site — ${week.label}`,
      detail: 'The whole week, a band per day, on one page. Prints on A3.',
      count: counts.siteWeek,
    },
  ]

  const empty = choices.find((choice) => choice.id === options.scope)?.count === 0

  return (
    <Modal
      title="Print or save a PDF"
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={empty} onClick={onPrint}>
            Save as PDF
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
          Opens your browser's print window: keep{' '}
          <strong className="font-medium">Save as PDF</strong> as the destination, or send it
          straight to a printer. Leave{' '}
          <strong className="font-medium">Background graphics</strong> on so the activity colours
          come through — the paper size is already set.
        </p>
      </div>
    </Modal>
  )
}
