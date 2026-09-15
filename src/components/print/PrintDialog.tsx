import type { PrintOptions, PrintScope } from './PrintView'
import { formatDate } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button, cx } from '@/components/ui/primitives'

/** Chooses what goes on paper before the browser print dialog opens. */
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
  counts: { booking: number; siteDay: number; siteWeek: number }
}) {
  const scopes: { id: PrintScope; label: string; detail: string; count: number }[] = [
    {
      id: 'booking',
      label: bookingName ? `${bookingName} — whole stay` : 'Selected school',
      detail: 'Every day of this school’s visit, one school per page.',
      count: counts.booking,
    },
    {
      id: 'site-day',
      label: `Everyone on site — ${formatDate(date)}`,
      detail: 'One page per school, just this day. Good for the daily run sheet.',
      count: counts.siteDay,
    },
    {
      id: 'site-week',
      label: 'Everyone on site — from this day on',
      detail: 'Every school currently booked, from this date forward.',
      count: counts.siteWeek,
    },
  ]

  return (
    <Modal
      title="Print itinerary"
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onPrint}>
            Print
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          {scopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => onChange({ scope: scope.id })}
              disabled={scope.count === 0}
              className={cx(
                'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                options.scope === scope.id
                  ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                  : 'border-[var(--line)] hover:bg-[var(--surface-sunk)]',
                scope.count === 0 && 'cursor-not-allowed opacity-45',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2',
                  options.scope === scope.id
                    ? 'border-[var(--brand)]'
                    : 'border-[var(--line-strong)]',
                )}
              >
                {options.scope === scope.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                  {scope.label}
                </span>
                <span className="block text-[11px] text-[var(--ink-soft)]">{scope.detail}</span>
              </span>
              <span className="tnum shrink-0 text-[11px] text-[var(--ink-faint)]">
                {scope.count === 0 ? 'none' : `${scope.count} page${scope.count === 1 ? '' : 's'}`}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1 border-t border-[var(--line)] pt-2">
          <Check
            label="Show staff names on sessions"
            checked={options.showStaff}
            onChange={(showStaff) => onChange({ showStaff })}
          />
          <Check
            label="Show venues on sessions"
            checked={options.showVenues}
            onChange={(showVenues) => onChange({ showVenues })}
          />
          <Check
            label="Include the activity colour key"
            checked={options.showLegend}
            onChange={(showLegend) => onChange({ showLegend })}
          />
        </div>

        <p className="rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11px] leading-snug text-[var(--ink-soft)]">
          Set your browser to <strong>Landscape</strong> and turn on{' '}
          <strong>Background graphics</strong> so the activity colours come through.
        </p>
      </div>
    </Modal>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12.5px] text-[var(--ink)] hover:bg-[var(--surface-sunk)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--brand)]"
      />
      {label}
    </label>
  )
}
