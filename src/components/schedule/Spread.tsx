import { useMemo } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate, weekdayShort } from '@/lib/time'
import { useDragStore } from '@/store/dragStore'
import { ScheduleGrid } from './ScheduleGrid'
import { TimeAxis } from './TimeAxis'
import { useDragScroller } from './useDragScroller'
import { cx } from '@/components/ui/primitives'

/**
 * Every day you've picked, side by side, with every school that's on site that
 * day inside it — all of them real grids against one shared time axis.
 *
 * One day and one school is the close-up you build in. One day and every
 * school is the site picture. A whole week and every school is the holistic
 * sheet, live. They are the same component because they are the same thing
 * with a different selection, and because a session dragged between any two
 * of those panels has to behave identically.
 *
 * Panel headings are drawn here rather than by the grids, at fixed heights, so
 * that every grid starts on the same line as the time axis. Get that wrong and
 * blocks read against the wrong hour.
 */

const DAY_HEADER_HEIGHT = 28
const SCHOOL_HEADER_HEIGHT = 40
const GROUP_ROW_HEIGHT = 24

export interface SpreadProps {
  /** The days to lay out, in order. */
  days: string[]
  /** Every school in scope; each day shows the ones on site that day. */
  bookings: Booking[]
  /** The day the day-scoped tools act on, highlighted in the headings. */
  activeDate: string
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
  /** Distinguishes this spread's grids from any other on screen. */
  gridScope: string
  /** Name each school above its columns — off when there is only ever one. */
  showSchoolNames: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  /** Point the day-scoped tools at this day. */
  onFocusDay: (date: string) => void
  onOpenBooking?: (id: string) => void
  onEmptyDoubleClick?: (bookingId: string, date: string, groupIndex: number, startMin: number) => void
}

export function Spread({
  days, bookings, activeDate, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail, showTimes,
  gridScope, showSchoolNames,
  onSelect, onClearSelection, onFocusDay, onOpenBooking, onEmptyDoubleClick,
}: SpreadProps) {
  const scrollRef = useDragScroller()
  const targetGridId = useDragStore((s) => (s.active ? (s.target?.gridId ?? null) : null))

  const showDays = days.length > 1
  const headerHeight =
    (showDays ? DAY_HEADER_HEIGHT : 0) +
    (showSchoolNames ? SCHOOL_HEADER_HEIGHT : 0) +
    GROUP_ROW_HEIGHT

  const byDay = useMemo(
    () =>
      days.map((day) => ({
        day,
        onSite: bookings.filter((b) => day >= b.startDate && day <= b.endDate),
      })),
    [days, bookings],
  )

  // A week of schools is up to forty grids; filtering the whole term's blocks
  // once per grid is the difference between a view that drags smoothly and one
  // that stutters, so they get bucketed once instead.
  const byPanel = useMemo(() => {
    const map = new Map<string, Block[]>()
    for (const block of blocks) {
      const key = `${block.bookingId}|${block.date}`
      const bucket = map.get(key)
      if (bucket) bucket.push(block)
      else map.set(key, [block])
    }
    return map
  }, [blocks])

  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-auto">
      <TimeAxis
        dayStartMin={dayStartMin}
        dayEndMin={dayEndMin}
        zoom={zoom}
        headerHeight={headerHeight}
      />

      <div className="flex min-w-0 flex-1">
        {byDay.map(({ day, onSite }) => {
          // A day panel is as wide as the schools inside it need; days with
          // more schools take more room rather than squeezing everyone.
          const width = Math.max(
            onSite.reduce((total, b) => total + panelWidth(b), 0),
            200,
          )
          return (
            <div
              key={day}
              className="flex min-w-0 flex-col border-r-2 border-[var(--line-strong)] last:border-r-0"
              style={{ flex: `1 1 ${width}px`, minWidth: width }}
            >
              {showDays && (
                <button
                  type="button"
                  onClick={() => onFocusDay(day)}
                  title="Point the day tools at this day"
                  className={cx(
                    'sticky top-0 z-50 flex shrink-0 items-baseline gap-1.5 border-b border-[var(--line)] px-2 text-left transition-colors',
                    day === activeDate
                      ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                      : 'bg-[var(--surface-sunk)] text-[var(--ink)] hover:bg-[var(--surface)]',
                  )}
                  style={{ height: DAY_HEADER_HEIGHT }}
                >
                  <span className="text-[11.5px] font-semibold">{weekdayShort(day)}</span>
                  <span
                    className={cx(
                      'tnum truncate text-[10.5px]',
                      day === activeDate ? 'opacity-80' : 'text-[var(--ink-faint)]',
                    )}
                  >
                    {formatDate(day)}
                  </span>
                </button>
              )}

              {onSite.length === 0 ? (
                <p
                  className="flex flex-1 items-start justify-center px-2 pt-3 text-[11px] text-[var(--ink-faint)] italic"
                  style={{ paddingTop: headerHeight - (showDays ? DAY_HEADER_HEIGHT : 0) + 12 }}
                >
                  Nobody on site
                </p>
              ) : (
                <div className="flex min-w-0 flex-1">
                  {onSite.map((booking) => {
                    const gridId = `${gridScope}:${booking.id}:${day}`
                    const isTarget = gridId === targetGridId
                    return (
                      <div
                        key={booking.id}
                        className={cx(
                          'relative flex min-w-0 flex-col border-r border-[var(--line)] last:border-r-0',
                          isTarget && 'bg-[var(--brand-tint)]',
                        )}
                        style={{ flex: `1 1 ${panelWidth(booking)}px`, minWidth: panelWidth(booking) }}
                      >
                        {showSchoolNames && (
                          <button
                            type="button"
                            onClick={() => onOpenBooking?.(booking.id)}
                            title={`${bookingHeadline(booking)} — ${bookingSubhead(booking)}`}
                            className="sticky z-40 shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                            style={{ top: showDays ? DAY_HEADER_HEIGHT : 0, height: SCHOOL_HEADER_HEIGHT }}
                          >
                            <span className="block truncate text-[11.5px] leading-tight font-semibold text-[var(--ink)]">
                              {bookingHeadline(booking)}
                            </span>
                            <span className="block truncate text-[10.5px] leading-tight text-[var(--ink-soft)]">
                              {bookingSubhead(booking)}
                            </span>
                          </button>
                        )}

                        {/* The grid's own heading row can't be sticky inside a
                            scroller this deep, so the group names are drawn
                            here at a known height instead. */}
                        <div
                          className="sticky z-30 grid shrink-0 border-b border-[var(--line)] bg-[var(--surface)]"
                          style={{
                            top:
                              (showDays ? DAY_HEADER_HEIGHT : 0) +
                              (showSchoolNames ? SCHOOL_HEADER_HEIGHT : 0),
                            height: GROUP_ROW_HEIGHT,
                            gridTemplateColumns: `repeat(${Math.max(booking.groups.length, 1)}, minmax(0, 1fr))`,
                          }}
                        >
                          {booking.groups.map((group) => (
                            <span
                              key={group.id}
                              className="truncate border-l border-[var(--line)] px-1 text-center text-[10.5px] leading-[23px] font-semibold text-[var(--ink-soft)] first:border-l-0"
                            >
                              {group.name}
                            </span>
                          ))}
                          {booking.groups.length === 0 && (
                            <span className="text-center text-[10.5px] leading-[23px] text-[var(--ink-faint)]">
                              No groups yet
                            </span>
                          )}
                        </div>

                        <ScheduleGrid
                          gridId={gridId}
                          compact
                          booking={booking}
                          date={day}
                          blocks={byPanel.get(`${booking.id}|${day}`) ?? EMPTY}
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
                          onEmptyDoubleClick={
                            onEmptyDoubleClick
                              ? (groupIndex, startMin) =>
                                  onEmptyDoubleClick(booking.id, day, groupIndex, startMin)
                              : undefined
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Shared empty array, so a quiet panel doesn't re-render on every pass. */
const EMPTY: Block[] = []

/** Enough room for a school's groups to stay readable, and no less. */
function panelWidth(booking: Booking): number {
  return Math.max(booking.groups.length * 104, 168)
}
