import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, Block, Booking } from '@/types'
import {
  blockTitle, bookingDates, bookingHeadline, bookingSubhead, exportFill,
} from '@/lib/exportImport'
import { bookingsOnDate, buildDayRows, daysWithBlocks } from '@/lib/itinerary'
import {
  addDays, dateRange, formatDateNumeric, formatTimeFull, startOfWeek, weekdayShort,
} from '@/lib/time'
import { termWeekOf, termWeekOfWeek } from '@/lib/term'
import { readableText } from '@/lib/colour'

/** One A4 landscape page at 96dpi, less a 10mm margin all round. */
const PAGE_WIDTH = 1047
const PAGE_HEIGHT = 718

export type PrintScope = 'booking' | 'booking-day' | 'site-day' | 'site-week'

export interface PrintOptions {
  scope: PrintScope
  showVenues: boolean
  showLegend: boolean
  /** Shrink each sheet until it fits its page rather than spilling onto a second. */
  fitToPage: boolean
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  scope: 'booking',
  showVenues: false,
  showLegend: true,
  fitToPage: true,
}

export interface PrintViewProps {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, { name: string }>
  programName: string
  options: PrintOptions
  siteName: string
  date: string
}

/**
 * Everything that goes on paper, laid out like the workbooks it replaces.
 *
 * The **school itinerary** is the single-school handout: a header, the note
 * that TL means teacher led, then a table per day with a column per group.
 * The **holistic** sheet stacks the days down the page and sets the schools
 * side by side, each keeping its own time column — because a day visit
 * arriving at 9.45 and a camp starting at 7.30 don't share a clock.
 *
 * Every sheet is laid out at a fixed A4-landscape size and then scaled down
 * until it fits, so "one page" is a guarantee rather than a hope.
 */
export function PrintView({
  bookings, blocks, activities, venues, programName, options, siteName, date,
}: PrintViewProps) {
  const weekStart = startOfWeek(date)
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  const footer = (
    <footer className="mt-auto flex shrink-0 items-center justify-between border-t border-neutral-300 pt-1 text-[7.5px] text-neutral-400">
      <span>{programName}</span>
      <span>Printed {new Date().toLocaleDateString('en-AU')}</span>
    </footer>
  )

  if (options.scope === 'site-week' || options.scope === 'site-day') {
    const days = options.scope === 'site-week' ? weekDays : [date]
    const term = options.scope === 'site-week' ? termWeekOfWeek(weekStart) : termWeekOf(date)

    return (
      <PrintRoot>
        <Sheet fit={options.fitToPage}>
          <HolisticSheet
            bookings={bookings}
            days={days}
            blocks={blocks}
            activities={activities}
            venues={venues}
            options={options}
            siteName={siteName}
            title={term.label}
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
            options={options}
            siteName={siteName}
            dates={options.scope === 'booking-day' ? [date] : bookingDates(booking)}
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
 * The content is laid out at full page size and then measured; if it overflows
 * either way it gets scaled down as a whole, which keeps every proportion —
 * column widths, colour blocks, the relationship between the header and the
 * tables — rather than reflowing into something that no longer reads like the
 * handout it replaces.
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
      const width = element.scrollWidth
      if (height <= 0 || width <= 0) return
      const next = Math.min(1, PAGE_HEIGHT / height, PAGE_WIDTH / width)
      setScale(Number(next.toFixed(4)))
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

function ItinerarySheet({
  booking, blocks, activities, venues, options, siteName, dates,
}: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, { name: string }>
  options: PrintOptions
  siteName: string
  dates: string[]
}) {
  const days = daysWithBlocks(booking, blocks, dates)
  const usedActivities = useMemo(
    () => collectActivities(blocks.filter((b) => days.includes(b.date)), activities),
    [blocks, days, activities],
  )
  const term = termWeekOf(booking.startDate)

  if (days.length === 0) {
    return <p className="p-6 text-[12px]">Nothing scheduled for {booking.schoolName}.</p>
  }

  return (
    <>
      <header className="mb-3 flex shrink-0 items-end justify-between gap-4 border-b-[2.5px] border-black pb-1.5">
        <div className="min-w-0">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            {siteName} · Itinerary
          </p>
          <h1 className="mt-0.5 text-[19px] leading-tight font-bold">{bookingHeadline(booking)}</h1>
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
          <p className="font-medium text-neutral-600">TL = Teacher Led</p>
        </div>
      </header>

      {booking.notes && (
        <p className="mb-2 shrink-0 border-l-[3px] border-neutral-300 pl-2 text-[10px] text-neutral-700">
          {booking.notes}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <DayTable
            key={day}
            booking={booking}
            date={day}
            blocks={blocks.filter((b) => b.date === day)}
            activities={activities}
            venues={venues}
            options={options}
            timeWidth={72}
            fontSize={10}
          />
        ))}
      </div>

      {options.showLegend && <Legend activities={usedActivities} />}
    </>
  )
}

/**
 * One day's table: the weekday in the corner, times down the left and a column
 * per group — the shape the school handout uses.
 */
function DayTable({
  booking, date, blocks, activities, venues, options, timeWidth, fontSize,
}: {
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, { name: string }>
  options: PrintOptions
  timeWidth: number
  fontSize: number
  /** Header shown above the group row, used by the holistic sheet. */
}) {
  const groupIds = useMemo(() => booking.groups.map((g) => g.id), [booking.groups])
  const rows = useMemo(() => buildDayRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  const columns = Math.max(booking.groups.length, 1)

  return (
    <table
      className="print-keep w-full border-collapse"
      style={{ tableLayout: 'fixed', fontSize }}
    >
      <colgroup>
        <col style={{ width: timeWidth }} />
        {Array.from({ length: columns }, (_, index) => (
          <col key={index} style={{ width: `calc((100% - ${timeWidth}px) / ${columns})` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="border border-neutral-500 bg-neutral-100 px-1.5 py-[3px] text-left align-middle font-bold">
            <span className="block text-[11px] leading-tight">{weekdayShort(date)}</span>
            <span className="tnum block text-[8px] font-normal text-neutral-600">
              {formatDateNumeric(date)}
            </span>
          </th>
          {booking.groups.map((group) => (
            <th
              key={group.id}
              className="border border-neutral-500 bg-neutral-100 px-1.5 py-[3px] text-center font-semibold"
            >
              {group.name}
              {group.size ? (
                <span className="ml-1 font-normal text-neutral-600">({group.size})</span>
              ) : null}
            </th>
          ))}
          {booking.groups.length === 0 && (
            <th className="border border-neutral-500 bg-neutral-100 px-1.5 py-[3px] text-center font-semibold">
              Group 1
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.startMin}>
            <td className="border border-neutral-400 px-1.5 py-[3px] align-middle">
              <span className="tnum block font-semibold">{formatTimeFull(row.startMin)}</span>
            </td>
            {row.cells.map((cell, index) => {
              const fill = cell.block ? exportFill(cell.block, activities) : undefined
              return (
                <td
                  key={index}
                  colSpan={cell.span}
                  className="border border-neutral-400 px-1.5 py-[3px] align-middle"
                  style={fill ? { background: fill, color: readableText(fill) } : undefined}
                >
                  {cell.block && (
                    <CellBody
                      block={cell.block}
                      activities={activities}
                      venues={venues}
                      options={options}
                    />
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CellBody({
  block, activities, venues, options,
}: {
  block: Block
  activities: Map<string, Activity>
  venues: Map<string, { name: string }>
  options: PrintOptions
}) {
  const activity = block.activityId ? activities.get(block.activityId) : undefined
  const venueName = options.showVenues && block.venueId ? venues.get(block.venueId)?.name : undefined

  return (
    <>
      <span className="block leading-snug font-medium whitespace-pre-line">
        {blockTitle(block, activity)}
      </span>
      {venueName && <span className="mt-px block text-[7.5px] leading-tight opacity-75">{venueName}</span>}
      {block.note && (
        <span className="mt-px block text-[7.5px] leading-tight italic opacity-75">{block.note}</span>
      )}
    </>
  )
}

// ─── the whole site ─────────────────────────────────────────────────────────

/**
 * Every school on site, one band per day, schools side by side.
 *
 * This is the holistic sheet the program team works from: read down a school's
 * column to see its day, read across the page to see everybody else's.
 */
function HolisticSheet({
  bookings, days, blocks, activities, venues, options, siteName, title,
}: {
  bookings: Booking[]
  days: string[]
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, { name: string }>
  options: PrintOptions
  siteName: string
  title: string
}) {
  const bands = useMemo(
    () =>
      days
        .map((date) => ({
          date,
          schools: bookingsOnDate(bookings, date).filter((booking) =>
            blocks.some((b) => b.bookingId === booking.id && b.date === date),
          ),
        }))
        .filter((band) => band.schools.length > 0),
    [days, bookings, blocks],
  )

  const usedActivities = useMemo(() => {
    const inRange = blocks.filter((b) => days.includes(b.date))
    return collectActivities(inRange, activities)
  }, [blocks, days, activities])

  if (bands.length === 0) {
    return <p className="p-6 text-[12px]">No school is on site in {title}.</p>
  }

  const schoolCount = new Set(bands.flatMap((b) => b.schools.map((s) => s.id))).size

  return (
    <>
      <header className="mb-2 flex shrink-0 items-end justify-between gap-4 border-b-[2.5px] border-black pb-1.5">
        <div className="min-w-0">
          <p className="text-[8.5px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            {siteName} · Holistic
          </p>
          <h1 className="mt-0.5 text-[19px] leading-tight font-bold">{title}</h1>
          <p className="text-[11px] text-neutral-700">
            {days.length === 1
              ? formatDateNumeric(days[0])
              : `${formatDateNumeric(days[0])} – ${formatDateNumeric(days[days.length - 1])}`}
          </p>
        </div>
        <p className="shrink-0 text-right text-[9.5px] text-neutral-600">
          {schoolCount} school{schoolCount === 1 ? '' : 's'} · TL = Teacher Led
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {bands.map((band) => (
          <div key={band.date} className="print-keep flex items-start gap-2">
            {band.schools.map((booking) => (
              <div
                key={booking.id}
                className="min-w-0"
                style={{ flex: `1 1 ${72 + booking.groups.length * 96}px` }}
              >
                <p className="mb-px truncate text-[9px] leading-tight font-bold">
                  {bookingHeadline(booking)}
                </p>
                <p className="mb-0.5 truncate text-[8px] leading-tight text-neutral-600">
                  {bookingSubhead(booking) || '—'}
                </p>
                <DayTable
                  booking={booking}
                  date={band.date}
                  blocks={blocks.filter((b) => b.bookingId === booking.id && b.date === band.date)}
                  activities={activities}
                  venues={venues}
                  options={options}
                  timeWidth={52}
                  fontSize={8}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {options.showLegend && <Legend activities={usedActivities} />}
    </>
  )
}

function Legend({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null
  return (
    <div className="mt-2.5 shrink-0 border-t border-neutral-300 pt-1.5">
      <p className="mb-1 text-[8px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
        Activities colour key
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

function collectActivities(blocks: Block[], activities: Map<string, Activity>): Activity[] {
  const seen = new Map<string, Activity>()
  for (const block of blocks) {
    if (!block.activityId) continue
    const activity = activities.get(block.activityId)
    if (activity) seen.set(activity.id, activity)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}
