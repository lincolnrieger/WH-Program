import { useMemo, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import type { PlanMode } from '@/store/persist'
import { DAY_TEMPLATES } from '@/data/templates'
import { bookingDates, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate, weekdayShort } from '@/lib/time'
import { ScheduleGrid } from './ScheduleGrid'
import { TimeAxis } from './TimeAxis'
import { Button, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 30
const STAY_HEADER_HEIGHT = 52
const STAY_GROUP_HEIGHT = 20

/**
 * The main editing surface for one school.
 *
 * **Day** is a column per group for the day you're on — the close-up you build
 * in. **Whole stay** lays every day of the visit out side by side against the
 * same time axis, which is the view you want when you're checking a group
 * doesn't do the tube slide twice, or dragging Wednesday's spare session back
 * to Tuesday.
 */
export function BookingView({
  booking, date, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail, showTimes,
  mode, onMode,
  onSelect, onClearSelection, onDateChange, onApplyTemplate, onOpenRotation,
  onClearDay, onEditBooking, onEmptyDoubleClick,
}: {
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venueNames: Map<string, string>
  selection: string[]
  highlightIds: string[]
  dayStartMin: number
  dayEndMin: number
  zoom: number
  dark: boolean
  showDetail: boolean
  showTimes: boolean
  mode: PlanMode
  onMode: (mode: PlanMode) => void
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onDateChange: (date: string) => void
  onApplyTemplate: (templateId: string) => void
  onOpenRotation: () => void
  onClearDay: () => void
  onEditBooking: () => void
  onEmptyDoubleClick: (groupIndex: number, startMin: number) => void
}) {
  const [templateOpen, setTemplateOpen] = useState(false)

  const dates = useMemo(() => bookingDates(booking), [booking])
  const forBooking = useMemo(
    () => blocks.filter((block) => block.bookingId === booking.id),
    [blocks, booking.id],
  )
  const dayBlocks = useMemo(
    () => forBooking.filter((block) => block.date === date),
    [forBooking, date],
  )

  const stay = mode === 'stay'

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-col gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-sunk)] p-0.5">
            {([
              ['day', 'Day'],
              ['stay', 'Whole stay'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onMode(value)}
                aria-pressed={mode === value}
                className={cx(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                  mode === value
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onEditBooking}
            className="min-w-0 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
          >
            <span className="block truncate text-[14px] leading-tight font-semibold text-[var(--ink)]">
              {bookingHeadline(booking)}
            </span>
            <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
              {bookingSubhead(booking)}
            </span>
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Button size="sm" onClick={() => setTemplateOpen((open) => !open)}>
                Day template
                <span aria-hidden className="text-[9px] opacity-60">
                  &#9662;
                </span>
              </Button>
              {templateOpen && (
                <Dropdown onClose={() => setTemplateOpen(false)}>
                  <p className="border-b border-[var(--line)] px-3 pt-1.5 pb-2 text-[11px] leading-snug text-[var(--ink-soft)]">
                    Lays the meals and logistics onto{' '}
                    <strong className="font-medium text-[var(--ink)]">{formatDate(date)}</strong> at
                    the standard times, so only the activities are left to place.
                  </p>
                  {DAY_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        onApplyTemplate(template.id)
                        setTemplateOpen(false)
                      }}
                      className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                    >
                      <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                        {template.name}
                      </span>
                      <span className="block text-[11px] leading-snug text-[var(--ink-faint)]">
                        {template.description}
                      </span>
                    </button>
                  ))}
                </Dropdown>
              )}
            </div>

            <Button size="sm" variant="primary" onClick={onOpenRotation}>
              Add activities
            </Button>

            {!stay && (
              <Button size="sm" variant="ghost" onClick={onClearDay}>
                Clear day
              </Button>
            )}
          </div>
        </div>

        {!stay && (
          <div className="flex flex-wrap gap-1">
            {dates.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => onDateChange(option)}
                className={cx(
                  'rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors',
                  option === date
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
                )}
              >
                <span className="tnum">
                  Day {index + 1} · {weekdayShort(option)}
                </span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 overflow-auto">
        <TimeAxis
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          zoom={zoom}
          headerHeight={stay ? STAY_HEADER_HEIGHT + STAY_GROUP_HEIGHT : HEADER_HEIGHT}
        />

        {stay ? (
          <div className="flex min-w-0 flex-1">
            {dates.map((day, index) => {
              const columnMin = Math.max(booking.groups.length * 104, 168)
              return (
                <div
                  key={day}
                  className="flex min-w-0 flex-col border-r border-[var(--line-strong)] last:border-r-0"
                  style={{ flex: `1 1 ${columnMin}px`, minWidth: columnMin }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onDateChange(day)
                      onMode('day')
                    }}
                    title="Open this day on its own"
                    className={cx(
                      'sticky top-0 z-40 shrink-0 border-b border-[var(--line)] px-2 py-1 text-left transition-colors',
                      day === date
                        ? 'bg-[var(--brand-tint)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-sunk)]',
                    )}
                    style={{ height: STAY_HEADER_HEIGHT }}
                  >
                    <span className="block text-[11.5px] leading-tight font-semibold text-[var(--ink)]">
                      Day {index + 1} · {weekdayShort(day)}
                    </span>
                    <span className="tnum block text-[10.5px] text-[var(--ink-faint)]">
                      {formatDate(day)}
                    </span>
                  </button>

                  {/* The grid's own heading row isn't sticky, so the group
                      names are drawn here where they can be — and at a known
                      height, which is what keeps every day level with the
                      time axis beside them. */}
                  <div
                    className="sticky z-30 grid shrink-0 border-b border-[var(--line)] bg-[var(--surface)]"
                    style={{
                      top: STAY_HEADER_HEIGHT,
                      height: STAY_GROUP_HEIGHT,
                      gridTemplateColumns: `repeat(${Math.max(booking.groups.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {booking.groups.map((group) => (
                      <span
                        key={group.id}
                        className="truncate border-l border-[var(--line)] px-1 text-center text-[10px] leading-[19px] font-medium text-[var(--ink-faint)] first:border-l-0"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>

                  <ScheduleGrid
                    gridId={`stay:${booking.id}:${day}`}
                    compact
                    booking={booking}
                    date={day}
                    blocks={forBooking.filter((block) => block.date === day)}
                    activities={activities}
                    venueNames={venueNames}
                    selection={selection}
                    highlightIds={highlightIds}
                    dayStartMin={dayStartMin}
                    dayEndMin={dayEndMin}
                    zoom={zoom}
                    dark={dark}
                    showDetail={showDetail}
                    showTimes={showTimes}
                    onSelect={onSelect}
                    onBackgroundClick={onClearSelection}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <ScheduleGrid
              gridId={`booking:${booking.id}:${date}`}
              booking={booking}
              date={date}
              blocks={dayBlocks}
              activities={activities}
              venueNames={venueNames}
              selection={selection}
              highlightIds={highlightIds}
              dayStartMin={dayStartMin}
              dayEndMin={dayEndMin}
              zoom={zoom}
              dark={dark}
              showDetail={showDetail}
              showTimes={showTimes}
              onSelect={onSelect}
              onBackgroundClick={onClearSelection}
              onEmptyDoubleClick={onEmptyDoubleClick}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-50 mt-1 w-[268px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </>
  )
}
