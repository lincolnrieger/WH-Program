import {
  Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import type { Activity, Block, Booking } from '@/types'
import { blockTitle, bookingDates, bookingHeadline, bookingSubhead, exportFill } from '@/lib/exportImport'
import { bookingsOnDate, buildDayRows, daysWithBlocks, type DayRow } from '@/lib/itinerary'
import {
  addDays, dateRange, formatDayShort, formatStayRange, formatTimeFull, startOfWeek, weekdayShort,
} from '@/lib/time'
import { readableText } from '@/lib/colour'

/**
 * The printed itineraries, laid out the way the program has always sent them
 * out: the school's own A4 program under the Woodhouse logo, and the week's
 * holistic sheet across A3.
 *
 * This is deliberately a reproduction rather than a redesign. Staff, teachers
 * and schools all know these two sheets by sight; what changed is only where
 * they come from — the app rather than a spreadsheet someone keeps by hand.
 */

/** A4 portrait at 96dpi, less a 12mm margin. */
const PROGRAM_WIDTH = 703
/** A3 landscape at 96dpi, less a 10mm margin. */
const HOLISTIC_WIDTH = 1511
const HOLISTIC_HEIGHT = 1047

/** The green the school's name is set in on every program sheet. */
const HEADING_GREEN = '#00b050'

/**
 * Cells past the end of a school's day are blacked out, which is how the
 * holistic sheet shows at a glance that a school has already left.
 */
const SPENT_CELL = '#000000'

export type PrintScope = 'booking' | 'booking-day' | 'site-day' | 'site-week'

export interface PrintOptions {
  scope: PrintScope
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { scope: 'booking' }

export interface PrintViewProps {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  programName: string
  options: PrintOptions
  date: string
}

/**
 * Sets the paper up for what's about to be printed.
 *
 * `@page` can't be written against a class and named pages aren't honoured
 * everywhere, so the rule is swapped out from here. The program is A4
 * portrait; the holistic sheet needs A3 to hold a week of schools at a size
 * anyone can read.
 */
function usePageSize(paper: 'a4-portrait' | 'a3-landscape'): void {
  useEffect(() => {
    const id = 'wh-print-page-size'
    const style =
      (document.getElementById(id) as HTMLStyleElement | null) ??
      document.head.appendChild(Object.assign(document.createElement('style'), { id }))
    style.textContent =
      paper === 'a4-portrait'
        ? '@page { size: A4 portrait; margin: 12mm; }'
        : '@page { size: A3 landscape; margin: 10mm; }'
  }, [paper])
}

export function PrintView({
  bookings, blocks, activities, programName, options, date,
}: PrintViewProps) {
  const holistic = options.scope === 'site-day' || options.scope === 'site-week'
  usePageSize(holistic ? 'a3-landscape' : 'a4-portrait')

  const weekStart = startOfWeek(date)
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  if (holistic) {
    return (
      <PrintRoot paper="a3-landscape">
        <HolisticPage>
          <HolisticSheet
            bookings={bookings}
            days={options.scope === 'site-week' ? weekDays : [date]}
            blocks={blocks}
            activities={activities}
          />
        </HolisticPage>
      </PrintRoot>
    )
  }

  if (bookings.length === 0) {
    return (
      <PrintRoot paper="a4-portrait">
        <ProgramPage>
          <p className="p-6 text-[13px]">Nothing scheduled to print.</p>
        </ProgramPage>
      </PrintRoot>
    )
  }

  return (
    <PrintRoot paper="a4-portrait">
      {bookings.map((booking) => (
        <ProgramPage key={booking.id}>
          <ProgramSheet
            booking={booking}
            blocks={blocks.filter((b) => b.bookingId === booking.id)}
            activities={activities}
            programName={programName}
            dates={options.scope === 'booking-day' ? [date] : bookingDates(booking)}
          />
        </ProgramPage>
      ))}
    </PrintRoot>
  )
}

function PrintRoot({ paper, children }: { paper: string; children: ReactNode }) {
  return (
    <div className={`print-only print-${paper}`} aria-hidden>
      {children}
    </div>
  )
}

function ProgramPage({ children }: { children: ReactNode }) {
  return (
    <section className="print-sheet print-sheet--flow" style={{ width: PROGRAM_WIDTH }}>
      {children}
    </section>
  )
}

/**
 * The holistic sheet has to land on one page, so it is laid out at A3 and
 * scaled down as a whole if a busy week overruns. Scaling keeps every
 * proportion, which reflowing would not.
 */
function HolisticPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    // Transforms don't change the border box, so measuring the unscaled
    // content can't feed back into itself.
    const measure = () => {
      const { scrollHeight, scrollWidth } = element
      if (scrollHeight <= 0 || scrollWidth <= 0) return
      setScale(
        Number(
          Math.min(1, HOLISTIC_HEIGHT / scrollHeight, HOLISTIC_WIDTH / scrollWidth).toFixed(4),
        ),
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children])

  return (
    <section
      className="print-sheet print-sheet--fixed"
      style={{ width: HOLISTIC_WIDTH, height: HOLISTIC_HEIGHT }}
    >
      <div
        ref={ref}
        style={{
          width: 'max-content',
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ─── the school's program ───────────────────────────────────────────────────

function ProgramSheet({
  booking, blocks, activities, programName, dates,
}: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  programName: string
  dates: string[]
}) {
  const days = daysWithBlocks(booking, blocks, dates)
  if (days.length === 0) {
    return <p className="p-6 text-[13px]">Nothing scheduled for {booking.schoolName}.</p>
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-4">
        <img
          src="/woodhouse-logo.png"
          alt={programName}
          style={{ width: 236, height: 'auto' }}
          className="shrink-0"
        />
        <div className="flex-1 text-center">
          <p
            className="text-[22px] leading-tight font-bold"
            style={{ color: HEADING_GREEN }}
          >
            {booking.schoolName}
          </p>
          <p className="mt-0.5 text-[13px] font-bold text-black">
            {formatStayRange(days[0], days[days.length - 1])}
          </p>
          <p className="text-[12px] text-black">TL = Teacher Led</p>
        </div>
      </header>

      <div className="space-y-4">
        {days.map((day) => (
          <DayTable
            key={day}
            booking={booking}
            date={day}
            blocks={blocks.filter((b) => b.date === day)}
            activities={activities}
          />
        ))}
      </div>
    </>
  )
}

/** One bordered day table: the weekday in the corner, a column per group. */
function DayTable({
  booking, date, blocks, activities,
}: {
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
}) {
  const groupIds = useMemo(() => booking.groups.map((g) => g.id), [booking.groups])
  const rows = useMemo(() => buildDayRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  const names = booking.groups.length > 0 ? booking.groups.map((g) => g.name) : ['Group 1']

  return (
    <table className="print-grid print-grid--boxed print-keep w-full" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '15%' }} />
        {names.map((name) => (
          <col key={name} style={{ width: `${85 / names.length}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="px-1 py-0.5 text-center text-[19px] leading-tight font-bold">
            {weekdayShort(date)}
          </th>
          {names.map((name) => (
            <th key={name} className="px-1 py-1 text-center text-[12.5px] font-bold">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SessionRow
            key={row.startMin}
            row={row}
            activities={activities}
            timeSize={11}
            bodySize={12}
          />
        ))}
      </tbody>
    </table>
  )
}

// ─── the holistic sheet ─────────────────────────────────────────────────────

interface SchoolDay {
  booking: Booking
  rows: DayRow[]
  columns: number
}

function HolisticSheet({
  bookings, days, blocks, activities,
}: {
  bookings: Booking[]
  days: string[]
  blocks: Block[]
  activities: Map<string, Activity>
}) {
  const bands = useMemo(
    () =>
      days
        .map((date) => ({
          date,
          schools: bookingsOnDate(bookings, date)
            .map((booking) => {
              const dayBlocks = blocks.filter(
                (b) => b.bookingId === booking.id && b.date === date,
              )
              return {
                booking,
                columns: Math.max(booking.groups.length, 1),
                rows: buildDayRows(dayBlocks, booking.groups.map((g) => g.id)),
              }
            })
            .filter((school) => school.rows.length > 0),
        }))
        .filter((band) => band.schools.length > 0),
    [days, bookings, blocks],
  )

  if (bands.length === 0) {
    return <p className="p-6 text-[13px]">No school is on site for these days.</p>
  }

  return (
    <div className="space-y-5">
      {bands.map((band) => (
        <HolisticBand
          key={band.date}
          date={band.date}
          schools={band.schools}
          activities={activities}
        />
      ))}
    </div>
  )
}

/** Time and group column widths on the holistic sheet, in layout pixels. */
const HOLISTIC_TIME = 64
const HOLISTIC_GROUP = 112
const HOLISTIC_GAP = 16

/**
 * One day, with every school on site that day side by side.
 *
 * It is a single table rather than one per school so that the rows line up
 * across the whole band — each school keeps its own time column, because a day
 * visit arriving at 9.45 and a camp starting at 7.30 don't share a clock, but
 * the bands still read straight across the page.
 */
function HolisticBand({
  date, schools, activities,
}: {
  date: string
  schools: SchoolDay[]
  activities: Map<string, Activity>
}) {
  const depth = Math.max(...schools.map((school) => school.rows.length))
  const width =
    schools.reduce(
      (total, school) => total + HOLISTIC_TIME + school.columns * HOLISTIC_GROUP,
      0,
    ) +
    HOLISTIC_GAP * (schools.length - 1)

  return (
    <table className="print-grid print-keep" style={{ tableLayout: 'fixed', width }}>
      <colgroup>
        {schools.map((school, index) => (
          <Fragment key={school.booking.id}>
            {index > 0 && <col style={{ width: HOLISTIC_GAP }} />}
            <col style={{ width: HOLISTIC_TIME }} />
            {Array.from({ length: school.columns }, (_, i) => (
              <col key={i} style={{ width: HOLISTIC_GROUP }} />
            ))}
          </Fragment>
        ))}
      </colgroup>

      <thead>
        <tr>
          {schools.map((school, index) => (
            <Fragment key={school.booking.id}>
              {index > 0 && <td className="print-gap" />}
              <th className="px-1 text-center text-[15px] leading-tight font-bold">
                {weekdayShort(date)}
              </th>
              <th
                colSpan={school.columns}
                className="px-1 py-0.5 text-center text-[9px] leading-tight font-semibold"
              >
                <span className="block">{bookingHeadline(school.booking)}</span>
                <span className="block font-normal">{bookingSubhead(school.booking) || ' '}</span>
              </th>
            </Fragment>
          ))}
        </tr>
        <tr>
          {schools.map((school, index) => (
            <Fragment key={school.booking.id}>
              {index > 0 && <td className="print-gap" />}
              <th className="px-1 text-center text-[9px] font-bold">
                {formatDayShort(date)}
              </th>
              {(school.booking.groups.length > 0
                ? school.booking.groups.map((g) => g.name)
                : ['Group 1']
              ).map((name) => (
                <th key={name} className="px-1 text-center text-[9px] font-bold">
                  {name}
                </th>
              ))}
            </Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {Array.from({ length: depth }, (_, index) => (
          <tr key={index}>
            {schools.map((school, schoolIndex) => {
              const row = school.rows[index]
              return (
                <Fragment key={school.booking.id}>
                  {schoolIndex > 0 && <td className="print-gap" />}
                  {row ? (
                    <SessionCells
                      row={row}
                      activities={activities}
                      timeSize={8.5}
                      bodySize={8.5}
                    />
                  ) : (
                    // The school has gone home; the rest of the band is spent.
                    <>
                      <td style={{ background: SPENT_CELL }} />
                      <td colSpan={school.columns} style={{ background: SPENT_CELL }} />
                    </>
                  )}
                </Fragment>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── rows shared by both sheets ─────────────────────────────────────────────

function SessionRow({
  row, activities, timeSize, bodySize,
}: {
  row: DayRow
  activities: Map<string, Activity>
  timeSize: number
  bodySize: number
}) {
  return (
    <tr>
      <SessionCells row={row} activities={activities} timeSize={timeSize} bodySize={bodySize} />
    </tr>
  )
}

function SessionCells({
  row, activities, timeSize, bodySize,
}: {
  row: DayRow
  activities: Map<string, Activity>
  timeSize: number
  bodySize: number
}) {
  return (
    <>
      <td className="px-1 text-center align-middle" style={{ fontSize: timeSize }}>
        {formatTimeFull(row.startMin)}
      </td>
      {row.cells.map((cell, index) => {
        const fill = cell.block ? exportFill(cell.block, activities) : undefined
        return (
          <td
            key={index}
            colSpan={cell.span}
            className="px-1 text-center align-middle"
            style={fill ? { background: fill, color: readableText(fill) } : undefined}
          >
            {cell.block && (
              <SessionText block={cell.block} activities={activities} size={bodySize} />
            )}
          </td>
        )
      })}
    </>
  )
}

/**
 * The text in one cell. The first line is the session; anything after it is the
 * small print the sheets carry underneath — "Pack bags, clean building…".
 */
function SessionText({
  block, activities, size,
}: {
  block: Block
  activities: Map<string, Activity>
  size: number
}) {
  const activity = block.activityId ? activities.get(block.activityId) : undefined
  const [heading, ...rest] = blockTitle(block, activity).split('\n')
  const detail = [...rest, block.note].filter(Boolean)

  return (
    <>
      <span className="block leading-tight" style={{ fontSize: size }}>
        {heading}
      </span>
      {detail.map((line, index) => (
        <span key={index} className="block leading-tight" style={{ fontSize: size - 2.5 }}>
          {line}
        </span>
      ))}
    </>
  )
}
