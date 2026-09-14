import { useMemo } from 'react'
import type { Activity, Block, Booking, Issue } from '@/types'
import { bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { addDays, dateRange, formatDate, startOfWeek, weekdayShort } from '@/lib/time'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { TimeAxis } from '@/components/schedule/TimeAxis'
import { Button, EmptyState, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 52

/**
 * The holistic view: every school on site for one day, side by side — the same
 * picture as the current "Holistic" sheet, but with clashes between schools
 * (shared venues, shared equipment, shared staff) flagged as you drag.
 */
export function WeekView({
  bookings, date, blocks, activities, venueNames, staffNames, issues,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showConflicts,
  onSelect, onClearSelection, onDateChange, onOpenBooking, onNewBooking,
}: {
  bookings: Booking[]
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venueNames: Map<string, string>
  staffNames: Map<string, string>
  issues: Issue[]
  selection: string[]
  highlightIds: string[]
  dayStartMin: number
  dayEndMin: number
  zoom: number
  dark: boolean
  showConflicts: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onDateChange: (date: string) => void
  onOpenBooking: (id: string) => void
  onNewBooking: () => void
}) {
  const weekDates = useMemo(() => {
    const monday = startOfWeek(date)
    return dateRange(monday, addDays(monday, 6))
  }, [date])

  const onSite = useMemo(
    () => bookings.filter((booking) => date >= booking.startDate && date <= booking.endDate),
    [bookings, date],
  )

  const dayIssues = useMemo(() => issues.filter((issue) => issue.date === date), [issues, date])

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {weekDates.map((option) => {
            const count = bookings.filter(
              (booking) => option >= booking.startDate && option <= booking.endDate,
            ).length
            const errors = issues.filter(
              (issue) => issue.date === option && issue.severity === 'error',
            ).length
            return (
              <button
                key={option}
                type="button"
                onClick={() => onDateChange(option)}
                className={cx(
                  'relative rounded-md border px-2.5 py-1 text-left transition-colors',
                  option === date
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-sunk)]',
                )}
              >
                <span className="block text-[12px] font-medium">{weekdayShort(option)}</span>
                <span
                  className={cx(
                    'tnum block text-[10.5px]',
                    option === date ? 'opacity-80' : 'text-[var(--ink-faint)]',
                  )}
                >
                  {count === 0 ? 'free' : `${count} school${count === 1 ? '' : 's'}`}
                </span>
                {errors > 0 && (
                  <span
                    aria-label={`${errors} clashes`}
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]"
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-[var(--ink-soft)]">{formatDate(date)}</span>
          <Button size="sm" onClick={() => onDateChange(addDays(date, -7))}>
            ‹ Prev week
          </Button>
          <Button size="sm" onClick={() => onDateChange(addDays(date, 7))}>
            Next week ›
          </Button>
        </div>
      </header>

      {onSite.length === 0 ? (
        <EmptyState
          title="Nobody on site"
          body={`No school is booked in for ${formatDate(date)}. Pick another day, or add a booking.`}
          action={
            <Button variant="primary" onClick={onNewBooking}>
              Add a school
            </Button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-auto">
          <TimeAxis
            dayStartMin={dayStartMin}
            dayEndMin={dayEndMin}
            zoom={zoom}
            headerHeight={HEADER_HEIGHT}
          />

          <div className="flex min-w-0 flex-1">
            {onSite.map((booking) => {
              const dayBlocks = blocks.filter(
                (block) => block.bookingId === booking.id && block.date === date,
              )
              const columnMin = Math.max(booking.groups.length * 104, 168)

              return (
                <div
                  key={booking.id}
                  className="flex min-w-0 flex-col border-r border-[var(--line-strong)] last:border-r-0"
                  style={{ flex: `1 1 ${columnMin}px`, minWidth: columnMin }}
                >
                  <div
                    className="sticky top-0 z-40 shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1"
                    style={{ height: HEADER_HEIGHT }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenBooking(booking.id)}
                      className="block w-full truncate text-left"
                      title={`${bookingHeadline(booking)} — ${bookingSubhead(booking)}`}
                    >
                      <span className="block truncate text-[11.5px] leading-tight font-semibold text-[var(--ink)]">
                        {bookingHeadline(booking)}
                      </span>
                      <span className="block truncate text-[10.5px] text-[var(--ink-soft)]">
                        {bookingSubhead(booking)}
                      </span>
                    </button>
                  </div>

                  <div
                    className="sticky z-30 grid shrink-0 border-b border-[var(--line)] bg-[var(--surface)]"
                    style={{
                      top: HEADER_HEIGHT,
                      gridTemplateColumns: `repeat(${Math.max(booking.groups.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {booking.groups.map((group) => (
                      <span
                        key={group.id}
                        className="truncate border-l border-[var(--line)] px-1 py-0.5 text-center text-[10px] font-medium text-[var(--ink-faint)] first:border-l-0"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>

                  <ScheduleGrid
                    gridId={`week:${booking.id}:${date}`}
                    booking={booking}
                    date={date}
                    blocks={dayBlocks}
                    activities={activities}
                    venueNames={venueNames}
                    staffNames={staffNames}
                    issues={dayIssues}
                    selection={selection}
                    highlightIds={highlightIds}
                    dayStartMin={dayStartMin}
                    dayEndMin={dayEndMin}
                    zoom={zoom}
                    dark={dark}
                    showConflicts={showConflicts}
                    onSelect={onSelect}
                    onBackgroundClick={onClearSelection}
                    compact
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
