import {
  useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import type { Activity, Block, Booking, StaffMember, Venue } from '@/types'
import {
  blockTitle, bookingDates, bookingHeadline, bookingSubhead, staffLabels,
} from '@/lib/exportImport'
import {
  addDays, dateRange, formatDate, formatDateNumeric, formatTime, formatTimeFull, startOfWeek,
  weekdayShort,
} from '@/lib/time'
import { termWeekOf, termWeekOfWeek } from '@/lib/term'
import { mix, readableText } from '@/lib/colour'

/** One A4 landscape page at 96dpi, less a 10mm margin all round. */
const PAGE_WIDTH = 1047
const PAGE_HEIGHT = 718

export type PrintScope = 'booking' | 'booking-day' | 'site-day' | 'site-week'

export type PrintAudience = 'staff' | 'school'

export interface PrintOptions {
  scope: PrintScope
  /**
   * Who the sheet is for. A school handout carries the same colours and times
   * but no staff names — it's their itinerary, not our roster.
   */
  audience: PrintAudience
  showVenues: boolean
  showLegend: boolean
  /** Shrink each sheet until it fits its page rather than spilling onto a second. */
  fitToPage: boolean
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  scope: 'booking',
  audience: 'staff',
  showVenues: false,
  showLegend: true,
  fitToPage: true,
}

export interface PrintViewProps {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  programName: string
  options: PrintOptions
  siteName: string
  date: string
}

/**
 * Everything that goes on paper.
 *
 * Four sheets, all of them designed to land on exactly one page: a school's
 * whole stay with the days stacked down the page, a single day of it, the
 * whole site for one day, and the whole site for a whole week — every school,
 * every building, side by side. Each sheet is laid out at a fixed A4-landscape
 * width and then scaled down until it fits, so "one page" is a guarantee
 * rather than a hope.
 */
export function PrintView({
  bookings, blocks, activities, venues, staff, programName, options, siteName, date,
}: PrintViewProps) {
  const weekStart = startOfWeek(date)
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  const footer = (
    <footer className="mt-auto flex shrink-0 items-center justify-between border-t border-neutral-300 pt-1 text-[7.5px] text-neutral-400">
      <span>{programName}</span>
      <span>
        {options.audience === 'school' ? 'Itinerary' : 'Staff run sheet'} · printed{' '}
        {new Date().toLocaleDateString('en-AU')}
      </span>
    </footer>
  )

  if (options.scope === 'site-week') {
    return (
      <PrintRoot>
        <Sheet fit={options.fitToPage}>
          <HolisticWeek
            bookings={bookings}
            days={weekDays}
            blocks={blocks}
            activities={activities}
            options={options}
            siteName={siteName}
            programName={programName}
          />
          {footer}
        </Sheet>
      </PrintRoot>
    )
  }

  if (options.scope === 'site-day') {
    return (
      <PrintRoot>
        <Sheet fit={options.fitToPage}>
          <HolisticDay
            bookings={bookings}
            date={date}
            blocks={blocks}
            activities={activities}
            venues={venues}
            staff={staff}
            options={options}
            siteName={siteName}
          />
          {footer}
        </Sheet>
      </PrintRoot>
    )
  }

  if (bookings.length === 0) {
    return (
      <PrintRoot>
        <Sheet fit={false}>
          <p className="p-6 text-[12px]">Nothing scheduled to print.</p>
        </Sheet>
      </PrintRoot>
    )
  }

  return (
    <PrintRoot>
      {bookings.map((booking) => (
        <Sheet key={booking.id} fit={options.fitToPage}>
          <ItinerarySheet
            booking={booking}
            blocks={blocks.filter((b) => b.bookingId === booking.id)}
            activities={activities}
            venues={venues}
            staff={staff}
            options={options}
            siteName={siteName}
            dates={
              options.scope === 'booking-day'
                ? [date]
                : bookingDates(booking)
            }
          />
          {footer}
        </Sheet>
      ))}
    </PrintRoot>
  )
}

function PrintRoot({ children }: { children: ReactNode }) {
  return (
    <div className="print-only" aria-hidden>
      {children}
    </div>
  )
}

/**
 * One page, scaled to fit.
 *
 * The content is laid out at full page width and then measured; if it is
 * taller than the page it gets scaled down as a whole, which keeps every
 * proportion — column widths, colour blocks, the relationship between the
 * header and the tables — rather than reflowing into something that no longer
 * reads like the handout it replaces.
 */
function Sheet({ children, fit }: { children: ReactNode; fit: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (!fit) {
      setScale(1)
      return
    }

    // Transforms don't change the border box, so observing the unscaled
    // content can't feed back into itself.
    const measure = () => {
      const height = element.scrollHeight
      if (height <= 0) return
      setScale(Math.min(1, Number((PAGE_HEIGHT / height).toFixed(4))))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fit, children])

  return (
    <section className="print-sheet">
      <div
        ref={ref}
        className="flex flex-col"
        style={{
          width: PAGE_WIDTH,
          minHeight: scale === 1 ? PAGE_HEIGHT : undefined,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ─── one school ─────────────────────────────────────────────────────────────

/**
 * A school's itinerary with its days stacked down the page.
 *
 * Each day gets a coloured marker down its left edge and its own time grid, so
 * a three-day camp reads as three bands on one sheet instead of three pages
 * that have to be laid side by side on a table.
 */
function ItinerarySheet({
  booking, blocks, activities, venues, staff, options, siteName, dates,
}: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  options: PrintOptions
  siteName: string
  dates: string[]
}) {
  const days = dates.filter((day) => blocks.some((b) => b.date === day))
  const allDays = bookingDates(booking)

  const usedActivities = useMemo(() => {
    const seen = new Map<string, Activity>()
    for (const block of blocks) {
      if (!block.activityId || !days.includes(block.date)) continue
      const activity = activities.get(block.activityId)
      if (activity) seen.set(activity.id, activity)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [blocks, days, activities])

  const term = termWeekOf(booking.startDate)

  if (days.length === 0) {
    return <p className="p-6 text-[12px]">Nothing scheduled for {booking.schoolName}.</p>
  }

  return (
    <>
      <header className="mb-2.5 flex shrink-0 items-end justify-between gap-4 border-b-[2.5px] border-black pb-1.5">
        <div className="min-w-0">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            {siteName} · Itinerary
          </p>
          <h1 className="mt-0.5 text-[18px] leading-tight font-bold">
            {bookingHeadline(booking)}
          </h1>
          <p className="text-[11px] text-neutral-700">{bookingSubhead(booking)}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] leading-snug text-neutral-700">
          <p className="font-semibold text-black">
            {formatDateNumeric(booking.startDate)} – {formatDateNumeric(booking.endDate)}
          </p>
          {term.term !== null && <p>{term.label}</p>}
          <p>
            {booking.groups.length} group{booking.groups.length === 1 ? '' : 's'}
            {booking.studentCount ? ` · ${booking.studentCount} students` : ''}
          </p>
          <p className="text-neutral-500">TL = Teacher-Led{options.audience === 'staff' ? ' · # = in training' : ''}</p>
        </div>
      </header>

      {booking.notes && (
        <p className="mb-2 shrink-0 border-l-[3px] border-neutral-300 pl-2 text-[10px] text-neutral-700">
          {booking.notes}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {days.map((day) => (
          <DayBand
            key={day}
            booking={booking}
            date={day}
            dayNumber={allDays.indexOf(day) + 1}
            totalDays={allDays.length}
            blocks={blocks.filter((b) => b.date === day)}
            activities={activities}
            venues={venues}
            staff={staff}
            options={options}
          />
        ))}
      </div>

      {options.showLegend && usedActivities.length > 0 && (
        <div className="mt-2.5 shrink-0 border-t border-neutral-300 pt-1.5">
          <p className="mb-1 text-[8px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
            Activities this stay
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {usedActivities.map((activity) => (
              <span key={activity.id} className="flex items-center gap-1 text-[9px]">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-[2px] border border-neutral-400"
                  style={{ background: activity.colour }}
                />
                {activity.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/** One day of a stay: a labelled marker down the left, the grid to the right. */
function DayBand({
  booking, date, dayNumber, totalDays, blocks, activities, venues, staff, options,
}: {
  booking: Booking
  date: string
  dayNumber: number
  totalDays: number
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  options: PrintOptions
}) {
  const groupIds = booking.groups.map((g) => g.id)
  const rows = useMemo(() => buildRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  const columns = Math.max(booking.groups.length, 1)
  const term = termWeekOf(date)

  return (
    <div className="print-keep flex gap-2">
      <div className="flex w-[74px] shrink-0 flex-col justify-start rounded-[3px] bg-neutral-800 px-1.5 py-1 text-white">
        <span className="text-[8px] font-semibold tracking-[0.1em] text-neutral-300 uppercase">
          Day {dayNumber}
          {totalDays > 1 ? `/${totalDays}` : ''}
        </span>
        <span className="text-[13px] leading-tight font-bold">{weekdayShort(date)}</span>
        <span className="tnum text-[9.5px] text-neutral-300">
          {Number(date.slice(8))} {formatDate(date).split(' ')[2]}
        </span>
        {term.week !== null && (
          <span className="mt-0.5 text-[8px] text-neutral-400">{term.shortLabel}</span>
        )}
      </div>

      <table className="w-full border-collapse text-[9.5px]" style={{ tableLayout: 'fixed' }}>
        {/* Fixed time gutter, then the remaining width split evenly — percentages
            alone would overflow once the gutter is added. */}
        <colgroup>
          <col style={{ width: '58px' }} />
          {booking.groups.map((group) => (
            <col key={group.id} style={{ width: `calc((100% - 58px) / ${columns})` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-1.5 py-[3px] text-left text-[8.5px] font-semibold">
              Time
            </th>
            {booking.groups.map((group) => (
              <th
                key={group.id}
                className="border border-neutral-400 bg-neutral-100 px-1.5 py-[3px] text-left text-[8.5px] font-semibold"
              >
                {group.name}
                {group.size ? (
                  <span className="ml-1 font-normal text-neutral-600">({group.size})</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.startMin}-${row.endMin}`}>
              <td className="border border-neutral-400 px-1.5 py-[3px] align-top">
                <span className="block font-semibold tabular-nums">{formatTime(row.startMin)}</span>
                <span className="block text-[7.5px] tabular-nums text-neutral-500">
                  {formatTimeFull(row.endMin)}
                </span>
              </td>

              {row.full ? (
                <td
                  colSpan={columns}
                  className="border border-neutral-400 px-1.5 py-[3px] align-top"
                  style={{ background: tint(row.full, activities) }}
                >
                  <Cell
                    block={row.full}
                    activities={activities}
                    venues={venues}
                    staff={staff}
                    options={options}
                  />
                </td>
              ) : (
                row.cells.map((cell, index) =>
                  cell === null ? null : (
                    <td
                      key={index}
                      colSpan={cell.span}
                      className="border border-neutral-400 px-1.5 py-[3px] align-top"
                      style={{ background: tint(cell.block, activities) }}
                    >
                      <Cell
                        block={cell.block}
                        activities={activities}
                        venues={venues}
                        staff={staff}
                        options={options}
                      />
                    </td>
                  ),
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({
  block, activities, venues, staff, options,
}: {
  block: Block
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  options: PrintOptions
}) {
  if (block.id === EMPTY_BLOCK.id) return null

  const activity = block.activityId ? activities.get(block.activityId) : undefined
  // A school's own copy is their itinerary, not our roster.
  const names = options.audience === 'staff' ? staffLabels(block, staff) : []
  const venueName = options.showVenues && block.venueId ? venues.get(block.venueId)?.name : undefined

  return (
    <>
      <span className="block leading-snug font-medium whitespace-pre-line">
        {blockTitle(block, activity)}
      </span>
      {(venueName || names.length > 0) && (
        <span className="mt-px block text-[7.5px] leading-tight text-neutral-600">
          {[venueName, names.join(', ')].filter(Boolean).join(' · ')}
        </span>
      )}
      {block.note && (
        <span className="mt-px block text-[7.5px] leading-tight text-neutral-500 italic">
          {block.note}
        </span>
      )}
    </>
  )
}

// ─── whole site, one day ────────────────────────────────────────────────────

/**
 * Every school on site for one day, on one page.
 *
 * Time runs down the left and every group of every school gets a column, which
 * is the shape of the holistic sheet this replaces — you read across a row to
 * see everything happening at 10am.
 */
function HolisticDay({
  bookings, date, blocks, activities, venues, staff, options, siteName,
}: {
  bookings: Booking[]
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  options: PrintOptions
  siteName: string
}) {
  const dayBlocks = useMemo(() => blocks.filter((b) => b.date === date), [blocks, date])

  const present = bookings.filter((b) => date >= b.startDate && date <= b.endDate)

  // One column per group, grouped under its school.
  const columns = useMemo(
    () =>
      present.flatMap((booking) =>
        booking.groups.map((group) => ({ booking, group })),
      ),
    [present],
  )

  const times = useMemo(() => {
    const set = new Set<number>()
    for (const block of dayBlocks) set.add(block.startMin)
    return [...set].sort((a, b) => a - b)
  }, [dayBlocks])

  const usedActivities = useMemo(() => collectActivities(dayBlocks, activities), [dayBlocks, activities])
  const term = termWeekOf(date)

  if (columns.length === 0 || times.length === 0) {
    return <p className="p-6 text-[12px]">Nothing scheduled on site for {formatDate(date)}.</p>
  }

  return (
    <>
      <HolisticHeader
        siteName={siteName}
        title={formatDate(date)}
        subtitle={term.label}
        right={`${present.length} school${present.length === 1 ? '' : 's'} · ${columns.length} groups`}
      />

      <table className="w-full border-collapse text-[8.5px]" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '46px' }} />
          {columns.map(({ booking, group }) => (
            <col key={`${booking.id}:${group.id}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="border border-neutral-400 bg-neutral-100 px-1 py-[3px] text-left text-[8px] font-semibold align-bottom"
            >
              Time
            </th>
            {present.map((booking) => (
              <th
                key={booking.id}
                colSpan={booking.groups.length}
                className="border border-neutral-500 bg-neutral-200 px-1 py-[3px] text-left text-[9px] font-bold"
              >
                <span className="block truncate">{bookingHeadline(booking)}</span>
                <span className="block truncate text-[7.5px] font-normal text-neutral-600">
                  {bookingSubhead(booking) || '—'}
                </span>
              </th>
            ))}
          </tr>
          <tr>
            {columns.map(({ booking, group }) => (
              <th
                key={`${booking.id}:${group.id}`}
                className="border border-neutral-400 bg-neutral-100 px-1 py-[2px] text-left text-[7.5px] font-semibold"
              >
                <span className="block truncate">{group.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((minute) => (
            <tr key={minute}>
              <td className="border border-neutral-400 px-1 py-[2px] align-top">
                <span className="block font-semibold tabular-nums">{formatTime(minute)}</span>
              </td>
              {holisticCells(columns, dayBlocks, minute).map((cell) => (
                <td
                  key={cell.key}
                  colSpan={cell.span}
                  className="border border-neutral-400 px-1 py-[2px] align-top"
                  style={{ background: cell.block ? tint(cell.block, activities) : 'transparent' }}
                >
                  {/* A session that started in an earlier row is already
                      labelled; keep its colour running so the block reads as
                      one thing rather than repeating itself. */}
                  {cell.block && !cell.continuing && (
                    <Cell
                      block={cell.block}
                      activities={activities}
                      venues={venues}
                      staff={staff}
                      options={options}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {options.showLegend && <Legend activities={usedActivities} />}
    </>
  )
}

// ─── whole site, whole week ─────────────────────────────────────────────────

/**
 * Every school and every building for a whole week, on one page.
 *
 * A time axis at this density would be unreadable, so each cell instead lists
 * that school's day in order, with the activity colours carried through — the
 * picture you want when you're working out where a new booking fits.
 */
function HolisticWeek({
  bookings, days, blocks, activities, options, siteName, programName,
}: {
  bookings: Booking[]
  days: string[]
  blocks: Block[]
  activities: Map<string, Activity>
  options: PrintOptions
  siteName: string
  programName: string
}) {
  const present = useMemo(
    () =>
      bookings
        .filter((b) => b.startDate <= days[6] && b.endDate >= days[0])
        .sort(
          (a, b) =>
            a.startDate.localeCompare(b.startDate) || a.schoolName.localeCompare(b.schoolName),
        ),
    [bookings, days],
  )

  const weekBlocks = useMemo(
    () => blocks.filter((b) => b.date >= days[0] && b.date <= days[6]),
    [blocks, days],
  )

  const usedActivities = useMemo(
    () => collectActivities(weekBlocks, activities),
    [weekBlocks, activities],
  )

  const term = termWeekOfWeek(days[0])

  if (present.length === 0) {
    return <p className="p-6 text-[12px]">No school is on site in {term.label}.</p>
  }

  return (
    <>
      <HolisticHeader
        siteName={siteName}
        title={term.label}
        subtitle={`${formatDate(days[0])} – ${formatDate(days[6])}`}
        right={`${present.length} school${present.length === 1 ? '' : 's'} · ${programName}`}
      />

      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '118px' }} />
          {days.map((day) => (
            <col key={day} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-1.5 py-[3px] text-left text-[8px] font-semibold tracking-wide uppercase">
              School · Building
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="border border-neutral-400 bg-neutral-100 px-1.5 py-[3px] text-left text-[9px] font-bold"
              >
                {weekdayShort(day)}
                <span className="tnum ml-1 font-normal text-neutral-600">
                  {Number(day.slice(8))}/{Number(day.slice(5, 7))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {present.map((booking) => (
            <tr key={booking.id} className="align-top">
              <th
                scope="row"
                className="border border-neutral-400 bg-neutral-50 px-1.5 py-1 text-left align-top"
              >
                <span className="block text-[9px] leading-tight font-bold">
                  {booking.schoolName}
                </span>
                <span className="block text-[8px] leading-tight text-neutral-600">
                  {[booking.yearLevel, booking.building].filter(Boolean).join(' · ') || '—'}
                </span>
                <span className="tnum block text-[7.5px] leading-tight text-neutral-500">
                  {booking.groups.length} group{booking.groups.length === 1 ? '' : 's'}
                  {booking.studentCount ? ` · ${booking.studentCount}` : ''}
                </span>
              </th>

              {days.map((day) => {
                const onSite = day >= booking.startDate && day <= booking.endDate
                const dayBlocks = weekBlocks
                  .filter((b) => b.bookingId === booking.id && b.date === day)
                  .sort((a, b) => a.startMin - b.startMin)

                return (
                  <td
                    key={day}
                    className="border border-neutral-400 px-[3px] py-[3px] align-top"
                    style={{ background: onSite ? 'transparent' : '#f3f3f1' }}
                  >
                    {onSite && dayBlocks.length === 0 && (
                      <span className="text-[7.5px] text-neutral-400 italic">Nothing planned</span>
                    )}
                    {onSite &&
                      dayBlocks.map((block) => (
                        <WeekLine
                          key={block.id}
                          block={block}
                          booking={booking}
                          activity={block.activityId ? activities.get(block.activityId) : undefined}
                        />
                      ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {options.showLegend && <Legend activities={usedActivities} />}
    </>
  )
}

/** One session on the week sheet: time, name, and which groups, in its colour. */
function WeekLine({
  block, booking, activity,
}: {
  block: Block
  booking: Booking
  activity?: Activity
}) {
  const colour = block.colour ?? activity?.colour
  const background = colour ? mix(colour, '#ffffff', 0.72) : '#f4f4f2'
  const rail = colour ?? '#b8b8b4'

  const groups =
    block.groupIds.length >= booking.groups.length
      ? ''
      : block.groupIds
          .map((id) => booking.groups.find((g) => g.id === id)?.name ?? '')
          .filter(Boolean)
          .join(', ')

  return (
    <span
      className="mb-[1.5px] flex items-baseline gap-1 overflow-hidden rounded-[2px] px-1 py-px"
      style={{ background, borderLeft: `2.5px solid ${rail}`, color: readableText(background) }}
    >
      <span className="tnum shrink-0 text-[7.5px] font-semibold">{formatTime(block.startMin)}</span>
      <span className="min-w-0 flex-1 truncate text-[8px] font-medium">
        {blockTitle(block, activity).replace(/\n/g, ' · ')}
      </span>
      {groups && <span className="shrink-0 text-[7px] opacity-70">{groups}</span>}
    </span>
  )
}

function HolisticHeader({
  siteName, title, subtitle, right,
}: {
  siteName: string
  title: string
  subtitle: string
  right: string
}) {
  return (
    <header className="mb-2 flex shrink-0 items-end justify-between gap-4 border-b-[2.5px] border-black pb-1.5">
      <div className="min-w-0">
        <p className="text-[8.5px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
          {siteName} · Holistic
        </p>
        <h1 className="mt-0.5 text-[18px] leading-tight font-bold">{title}</h1>
        <p className="text-[11px] text-neutral-700">{subtitle}</p>
      </div>
      <p className="shrink-0 text-right text-[9.5px] text-neutral-600">{right}</p>
    </header>
  )
}

function Legend({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null
  return (
    <div className="mt-2 shrink-0 border-t border-neutral-300 pt-1.5">
      <p className="mb-1 text-[8px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
        Activity colours
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {activities.map((activity) => (
          <span key={activity.id} className="flex items-center gap-1 text-[8.5px]">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-[2px] border border-neutral-400"
              style={{ background: activity.colour }}
            />
            {activity.name}
          </span>
        ))}
      </div>
    </div>
  )
}

interface HolisticColumn {
  booking: Booking
  group: { id: string; name: string; size?: number }
}

/**
 * One row of the holistic day sheet, with whole-school items merged.
 *
 * A block covering every group of a school occupies one cell spanning that
 * school's columns rather than repeating its name once per group — which is
 * how the sheet it replaces reads, and the difference between "lunch" written
 * once and written six times.
 */
function holisticCells(
  columns: HolisticColumn[],
  blocks: Block[],
  minute: number,
): { key: string; span: number; block?: Block; continuing: boolean }[] {
  const cells: { key: string; span: number; block?: Block; continuing: boolean }[] = []

  for (let index = 0; index < columns.length; ) {
    const { booking, group } = columns[index]
    const key = `${booking.id}:${group.id}`

    const block = blocks.find(
      (b) =>
        b.bookingId === booking.id &&
        b.groupIds.includes(group.id) &&
        b.startMin <= minute &&
        b.endMin > minute,
    )

    if (!block) {
      cells.push({ key, span: 1, continuing: false })
      index += 1
      continue
    }

    // Run on while the next column belongs to the same school and the same block.
    let span = 1
    while (
      index + span < columns.length &&
      columns[index + span].booking.id === booking.id &&
      block.groupIds.includes(columns[index + span].group.id)
    ) {
      span += 1
    }

    cells.push({ key, span, block, continuing: block.startMin < minute })
    index += span
  }

  return cells
}

function collectActivities(blocks: Block[], activities: Map<string, Activity>): Activity[] {
  const seen = new Map<string, Activity>()
  for (const block of blocks) {
    if (!block.activityId) continue
    const activity = activities.get(block.activityId)
    if (activity) seen.set(activity.id, activity)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Pale wash of the activity colour — groups by eye without eating toner. */
function tint(block: Block, activities: Map<string, Activity>): string {
  const colour =
    block.colour ?? (block.activityId ? activities.get(block.activityId)?.colour : undefined)
  if (!colour) return 'transparent'
  return mix(colour, '#ffffff', 0.78)
}

interface Row {
  startMin: number
  endMin: number
  cells: ({ block: Block; span: number } | null)[]
  full?: Block
}

/**
 * Collapses free-form blocks back into the row-per-start-time grid the printed
 * handout uses. Blocks sharing a start time sit on one row; a block covering
 * every group becomes a merged full-width row.
 */
function buildRows(blocks: Block[], groupIds: string[]): Row[] {
  const indexOf = new Map(groupIds.map((id, index) => [id, index]))
  const starts = [...new Set(blocks.map((b) => b.startMin))].sort((a, b) => a - b)

  return starts.map((startMin) => {
    const atTime = blocks.filter((b) => b.startMin === startMin)
    const endMin = Math.max(...atTime.map((b) => b.endMin))

    const wholeSchool = atTime.find(
      (block) => groupIds.length > 0 && block.groupIds.length >= groupIds.length,
    )
    if (wholeSchool && atTime.length === 1) {
      return { startMin, endMin, cells: [], full: wholeSchool }
    }

    const cells: Row['cells'] = new Array(Math.max(groupIds.length, 1)).fill(null)
    const filled = new Set<number>()

    for (const block of atTime) {
      const indices = block.groupIds
        .map((id) => indexOf.get(id))
        .filter((index): index is number => index !== undefined)
      if (indices.length === 0) continue

      const start = Math.min(...indices)
      const span = Math.max(...indices) - start + 1
      if (filled.has(start)) continue

      cells[start] = { block, span }
      for (let i = start; i < start + span; i += 1) filled.add(i)
    }

    // Any column with nothing in it still needs an empty cell so the row lines up.
    for (let i = 0; i < cells.length; i += 1) {
      if (!filled.has(i) && cells[i] === null) {
        cells[i] = { block: EMPTY_BLOCK, span: 1 }
        filled.add(i)
      }
    }

    return { startMin, endMin, cells }
  })
}

const EMPTY_BLOCK: Block = {
  id: '__empty__',
  bookingId: '',
  date: '',
  startMin: 0,
  endMin: 0,
  groupIds: [],
  kind: 'custom',
  title: '',
  delivery: 'staff',
  staffIds: [],
}
