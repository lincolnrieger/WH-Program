import { useMemo } from 'react'
import type { Activity, Block, Booking, Issue } from '@/types'
import { bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate } from '@/lib/time'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { TimeAxis } from '@/components/schedule/TimeAxis'
import { Button, EmptyState } from '@/components/ui/primitives'

const HEADER_HEIGHT = 52

/**
 * The holistic view: every school on site for one day, side by side — the same
 * picture as the current "Holistic" sheet, but with clashes between schools
 * (shared venues, shared equipment, shared staff) flagged as you drag.
 */
export function WeekView({
  bookings, date, blocks, activities, venueNames, staffNames, issues,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showConflicts, showDetail,
  onSelect, onClearSelection, onOpenBooking, onNewBooking,
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
  showDetail: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onOpenBooking: (id: string) => void
  onNewBooking: () => void
}) {
  const onSite = useMemo(
    () => bookings.filter((booking) => date >= booking.startDate && date <= booking.endDate),
    [bookings, date],
  )

  const dayIssues = useMemo(() => issues.filter((issue) => issue.date === date), [issues, date])

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
        <h1 className="text-[13px] font-semibold text-[var(--ink)]">{formatDate(date)}</h1>
        <span className="text-[11.5px] text-[var(--ink-soft)]">
          {onSite.length} school{onSite.length === 1 ? '' : 's'} on site
        </span>
        <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
          Drag a session between schools to move it across
        </span>
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
                    showDetail={showDetail}
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
