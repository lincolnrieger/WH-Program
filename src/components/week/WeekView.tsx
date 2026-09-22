import { useMemo, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { blockTitle, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { blockPalette } from '@/lib/colour'
import { addDays, dateRange, formatDate, formatTime, startOfWeek, weekdayShort } from '@/lib/time'
import { termWeekOfWeek } from '@/lib/term'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { TimeAxis } from '@/components/schedule/TimeAxis'
import { Button, EmptyState, Select, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 52

export type SiteMode = 'day' | 'week'

export interface WeekViewProps {
  bookings: Booking[]
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
  showTimes?: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onOpenBooking: (id: string) => void
  onNewBooking: () => void
  onDateChange: (date: string) => void
}

/**
 * The holistic view: what's happening across the site, either for one day or
 * for a whole week, for every school on site or just one.
 *
 * Day mode is the editing picture — the same grid as the planning view, one
 * column block per school, with clashes between schools flagged and sessions
 * draggable straight from one school to another. Week mode trades the time
 * axis for coverage: seven days at once, each school's sessions listed in
 * order, which is the view you want when you're deciding where a new booking
 * can go.
 */
export function WeekView({
  bookings, date, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail, showTimes,
  onSelect, onClearSelection, onOpenBooking, onNewBooking, onDateChange,
}: WeekViewProps) {
  const [mode, setMode] = useState<SiteMode>('day')
  const [focusId, setFocusId] = useState<string>('all')

  const weekStart = useMemo(() => startOfWeek(date), [date])
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  const inWeek = useMemo(
    () =>
      bookings
        .filter((b) => b.startDate <= weekDays[6] && b.endDate >= weekDays[0])
        .sort(
          (a, b) =>
            a.startDate.localeCompare(b.startDate) || a.schoolName.localeCompare(b.schoolName),
        ),
    [bookings, weekDays],
  )

  // "All schools" is the usual case; focusing one is how you check a single
  // stay against everything else on site without losing the week picture.
  // A school picked in one week isn't on site in the next, so the choice
  // falls back rather than emptying the view.
  const focused = inWeek.some((b) => b.id === focusId) ? focusId : 'all'
  const inScope = useMemo(
    () => (focused === 'all' ? bookings : bookings.filter((b) => b.id === focused)),
    [bookings, focused],
  )

  const onSite = useMemo(
    () => inScope.filter((booking) => date >= booking.startDate && date <= booking.endDate),
    [inScope, date],
  )

  const onSiteThisWeek = useMemo(
    () =>
      inScope.filter(
        (booking) => booking.startDate <= weekDays[6] && booking.endDate >= weekDays[0],
      ),
    [inScope, weekDays],
  )

  const term = termWeekOfWeek(weekStart)
  const shown = mode === 'day' ? onSite : onSiteThisWeek

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-sunk)] p-0.5">
          {(['day', 'week'] as SiteMode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cx(
                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                mode === value
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
              )}
            >
              {value === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-[13px] leading-tight font-semibold text-[var(--ink)]">
            {mode === 'day' ? formatDate(date) : term.label}
          </h1>
          <p className="tnum truncate text-[10.5px] leading-tight text-[var(--ink-faint)]">
            {mode === 'day'
              ? term.label
              : `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`}
            {' · '}
            {shown.length} school{shown.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Only the week in view: the list is a way to single out one of the
            schools on screen, not a directory of every booking in the term. */}
        <Select
          value={focused}
          onChange={(event) => setFocusId(event.target.value)}
          aria-label="Which schools to show"
          className="h-7 w-auto min-w-[150px] text-[12px]"
        >
          <option value="all">All schools this week</option>
          {inWeek.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.schoolName}
            </option>
          ))}
        </Select>

        <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
          {mode === 'day'
            ? 'Drag a session between schools to move it across'
            : 'Click a day to open it'}
        </span>
      </header>

      {shown.length === 0 ? (
        <EmptyState
          title="Nobody on site"
          body={
            mode === 'day'
              ? `No school is booked in for ${formatDate(date)}. Pick another day, or add a booking.`
              : `No school is booked in for ${term.label}. Pick another week, or add a booking.`
          }
          action={
            <Button variant="primary" onClick={onNewBooking}>
              Add a school
            </Button>
          }
        />
      ) : mode === 'day' ? (
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
                    compact
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <SiteWeek
          bookings={onSiteThisWeek}
          days={weekDays}
          activeDate={date}
          blocks={blocks}
          activities={activities}
          dark={dark}
          onOpenBooking={onOpenBooking}
          onDateChange={onDateChange}
        />
      )}
    </section>
  )
}

/**
 * Seven days across, one row per school.
 *
 * No time axis — at a week's density the axis costs more than it gives, and
 * what you actually want to read is "who's here, doing what, on which day".
 */
function SiteWeek({
  bookings, days, activeDate, blocks, activities, dark, onOpenBooking, onDateChange,
}: {
  bookings: Booking[]
  days: string[]
  activeDate: string
  blocks: Block[]
  activities: Map<string, Activity>
  dark: boolean
  onOpenBooking: (id: string) => void
  onDateChange: (date: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 170 }} />
          {days.map((day) => (
            <col key={day} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-20 bg-[var(--surface)]">
          <tr>
            <th className="border-b border-[var(--line)] px-2 py-1.5 text-left text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
              School
            </th>
            {days.map((day) => (
              <th key={day} className="border-b border-l border-[var(--line)] p-0">
                <button
                  type="button"
                  onClick={() => onDateChange(day)}
                  className={cx(
                    'flex w-full flex-col items-start px-2 py-1.5 text-left transition-colors',
                    day === activeDate
                      ? 'bg-[var(--brand-tint)]'
                      : 'hover:bg-[var(--surface-sunk)]',
                  )}
                >
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink)]">
                    {weekdayShort(day)}
                    <span className="tnum font-normal text-[var(--ink-faint)]">
                      {Number(day.slice(8))}
                    </span>
                    {day === today && (
                      <span aria-label="Today" className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    )}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="align-top">
              <th scope="row" className="border-b border-[var(--line)] p-0 text-left">
                <button
                  type="button"
                  onClick={() => onOpenBooking(booking.id)}
                  className="block w-full px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                >
                  <span className="block truncate text-[12px] leading-tight font-semibold text-[var(--ink)]">
                    {booking.schoolName}
                  </span>
                  <span className="block truncate text-[10.5px] text-[var(--ink-soft)]">
                    {[booking.yearLevel, booking.building].filter(Boolean).join(' · ')}
                  </span>
                  <span className="tnum block truncate text-[10px] text-[var(--ink-faint)]">
                    {booking.groups.length} group{booking.groups.length === 1 ? '' : 's'}
                    {booking.studentCount ? ` · ${booking.studentCount}` : ''}
                  </span>
                </button>
              </th>

              {days.map((day) => {
                const onSite = day >= booking.startDate && day <= booking.endDate
                const dayBlocks = blocks
                  .filter((b) => b.bookingId === booking.id && b.date === day)
                  .sort((a, b) => a.startMin - b.startMin)

                return (
                  <td
                    key={day}
                    onDoubleClick={() => onDateChange(day)}
                    className={cx(
                      'border-b border-l border-[var(--line)] px-1 py-1',
                      !onSite && 'bg-[var(--surface-sunk)]',
                      day === activeDate && 'bg-[var(--brand-tint)]',
                    )}
                  >
                    {!onSite ? (
                      <span className="sr-only">Not on site</span>
                    ) : dayBlocks.length === 0 ? (
                      <span className="block px-1 text-[10.5px] text-[var(--ink-faint)] italic">
                        Nothing planned
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-[2px]">
                        {dayBlocks.map((block) => (
                          <WeekChip
                            key={block.id}
                            block={block}
                            activity={block.activityId ? activities.get(block.activityId) : undefined}
                            booking={booking}
                            dark={dark}
                          />
                        ))}
                      </ul>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WeekChip({
  block, activity, booking, dark,
}: {
  block: Block
  activity?: Activity
  booking: Booking
  dark: boolean
}) {
  const colour = block.colour ?? activity?.colour ?? '#8a8f98'
  const palette = blockPalette(colour, dark)
  const groups =
    block.groupIds.length >= booking.groups.length
      ? 'All'
      : block.groupIds
          .map((id) => booking.groups.find((g) => g.id === id)?.name ?? '')
          .filter(Boolean)
          .join(', ')

  return (
    <li
      title={`${formatTime(block.startMin)} · ${blockTitle(block, activity)} · ${groups}`}
      className="flex items-center gap-1 overflow-hidden rounded-[4px] border px-1 py-[1px]"
      style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
    >
      <span aria-hidden className="h-2.5 w-[2px] shrink-0 rounded-full" style={{ background: palette.rail }} />
      <span className="tnum shrink-0 text-[9.5px]" style={{ color: palette.muted }}>
        {formatTime(block.startMin)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium">
        {blockTitle(block, activity).replace(/\n/g, ' · ')}
      </span>
      {groups !== 'All' && (
        <span className="shrink-0 text-[9px]" style={{ color: palette.muted }}>
          {groups}
        </span>
      )}
    </li>
  )
}
