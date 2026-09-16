import type { PrintAudience, PrintOptions, PrintScope } from './PrintView'
import { formatDate, startOfWeek } from '@/lib/time'
import { termWeekOfWeek } from '@/lib/term'
import { Modal } from '@/components/ui/Modal'
import { Button, cx } from '@/components/ui/primitives'

export interface PrintCounts {
  booking: number
  siteDay: number
  siteWeek: number
}

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
  counts: PrintCounts
}) {
  const week = termWeekOfWeek(startOfWeek(date))

  const scopes: { id: PrintScope; label: string; detail: string; count: number }[] = [
    {
      id: 'booking',
      label: bookingName ? `${bookingName} — whole stay` : 'Selected school — whole stay',
      detail: 'Every day of the visit stacked down one page, one page per school.',
      count: counts.booking,
    },
    {
      id: 'booking-day',
      label: bookingName ? `${bookingName} — ${formatDate(date)}` : 'Selected school — one day',
      detail: 'Just this day of this school’s visit.',
      count: counts.booking,
    },
    {
      id: 'site-day',
      label: `Holistic — ${formatDate(date)}`,
      detail: 'Every school on site that day, time down the left, on one page.',
      count: counts.siteDay,
    },
    {
      id: 'site-week',
      label: `Holistic — ${week.label}`,
      detail: 'Every school and building for the whole week, on one page.',
      count: counts.siteWeek,
    },
  ]

  const audiences: { id: PrintAudience; label: string; detail: string }[] = [
    {
      id: 'staff',
      label: 'Staff run sheet',
      detail: 'Staff names on every session, trainees marked with #.',
    },
    {
      id: 'school',
      label: 'School handout',
      detail: 'The same itinerary and colours with no staff names on it.',
    },
  ]

  return (
    <Modal
      title="Print"
      width={520}
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
        <Group label="What to print">
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
                <Radio on={options.scope === scope.id} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                    {scope.label}
                  </span>
                  <span className="block text-[11px] text-[var(--ink-soft)]">{scope.detail}</span>
                </span>
                <span className="tnum shrink-0 text-[11px] text-[var(--ink-faint)]">
                  {scope.count === 0
                    ? 'none'
                    : scope.id.startsWith('site')
                      ? '1 page'
                      : `${scope.count} page${scope.count === 1 ? '' : 's'}`}
                </span>
              </button>
            ))}
          </div>
        </Group>

        <Group label="Who it's for">
          <div className="grid grid-cols-2 gap-1.5">
            {audiences.map((audience) => (
              <button
                key={audience.id}
                type="button"
                onClick={() => onChange({ audience: audience.id })}
                className={cx(
                  'rounded-lg border px-2.5 py-2 text-left transition-colors',
                  options.audience === audience.id
                    ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                    : 'border-[var(--line)] hover:bg-[var(--surface-sunk)]',
                )}
              >
                <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                  {audience.label}
                </span>
                <span className="block text-[11px] leading-snug text-[var(--ink-soft)]">
                  {audience.detail}
                </span>
              </button>
            ))}
          </div>
        </Group>

        <div className="space-y-1 border-t border-[var(--line)] pt-2">
          <Check
            label="Fit each sheet onto one page"
            hint="Shrinks the whole sheet rather than letting it spill over."
            checked={options.fitToPage}
            onChange={(fitToPage) => onChange({ fitToPage })}
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
          Print in <strong>Landscape</strong> with <strong>Background graphics</strong> turned on so
          the activity colours come through.
        </p>
      </div>
    </Modal>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2',
        on ? 'border-[var(--brand)]' : 'border-[var(--line-strong)]',
      )}
    >
      {on && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />}
    </span>
  )
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      title={hint}
      className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-[12.5px] text-[var(--ink)] hover:bg-[var(--surface-sunk)]"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--brand)]"
      />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-[var(--ink-soft)]">{hint}</span>}
      </span>
    </label>
  )
}
