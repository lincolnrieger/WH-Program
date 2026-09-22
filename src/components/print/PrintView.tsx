import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { blockTitle, bookingDates, exportFill } from '@/lib/exportImport'
import { bookingsOnDate, buildDayRows, daysWithBlocks } from '@/lib/itinerary'
import {
  addDays, dateRange, formatDateLong, formatDateRangeLong, formatTimeFull, startOfWeek,
} from '@/lib/time'
import { termWeekOf, termWeekOfWeek } from '@/lib/term'
import { mix } from '@/lib/colour'

/** A4 landscape at 96dpi, less a 10mm margin — the holistic sheet's canvas. */
const WIDE_WIDTH = 1047
const WIDE_HEIGHT = 718
/** A4 portrait at 96dpi, less a 14mm margin — the school handout's column. */
const TALL_WIDTH = 688

export type PrintScope = 'booking' | 'booking-day' | 'site-day' | 'site-week'

/**
 * Sets the paper up for what's about to be printed.
 *
 * `@page` can't be written against a class, and named pages aren't honoured
 * everywhere, so the rule is swapped out from here instead. A school handout
 * wants portrait with a wide margin; the holistic sheet wants landscape.
 */
function usePageSize(orientation: 'portrait' | 'landscape'): void {
  useEffect(() => {
    const id = 'wh-print-page-size'
    const style =
      (document.getElementById(id) as HTMLStyleElement | null) ??
      document.head.appendChild(Object.assign(document.createElement('style'), { id }))
    style.textContent =
      orientation === 'portrait'
        ? '@page { size: A4 portrait; margin: 14mm; }'
        : '@page { size: A4 landscape; margin: 10mm; }'
  }, [orientation])
}

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
 * Everything that goes on paper.
 *
 * A handout is read by a teacher on a bus and a staff member on a hill, so it
 * is built to be read rather than to be dense: one school per sheet, days down
 * the page in portrait, and type at a size that survives a photocopier. Where
 * the spreadsheet filled a cell with a saturated colour, this uses a soft wash
 * of the same hue with a solid edge — the colour language staff already know,
 * without a page that fights you.
 *
 * The holistic sheet is the exception. Its whole job is to show every school at
 * once, so it stays landscape and is scaled down until it fits one page.
 */
export function PrintView({
  bookings, blocks, activities, programName, options, date,
}: PrintViewProps) {
  const holistic = options.scope === 'site-day' || options.scope === 'site-week'
  usePageSize(holistic ? 'landscape' : 'portrait')

  const weekStart = startOfWeek(date)
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  if (holistic) {
    const days = options.scope === 'site-week' ? weekDays : [date]
    const term = options.scope === 'site-week' ? termWeekOfWeek(weekStart) : termWeekOf(date)

    return (
      <PrintRoot orientation="landscape">
        <WideSheet>
          <HolisticSheet
            bookings={bookings}
            days={days}
            blocks={blocks}
            activities={activities}
            title={options.scope === 'site-week' ? term.label : formatDateLong(date)}
            subtitle={
              options.scope === 'site-week'
                ? formatDateRangeLong(days[0], days[days.length - 1])
                : term.label
            }
            programName={programName}
          />
        </WideSheet>
      </PrintRoot>
    )
  }

  if (bookings.length === 0) {
    return (
      <PrintRoot orientation="portrait">
        <TallSheet>
          <p className="p-6 text-[13px]">Nothing scheduled to print.</p>
        </TallSheet>
      </PrintRoot>
    )
  }

  return (
    <PrintRoot orientation="portrait">
      {bookings.map((booking) => (
        <TallSheet key={booking.id}>
          <ItinerarySheet
            booking={booking}
            blocks={blocks.filter((b) => b.bookingId === booking.id)}
            activities={activities}
            programName={programName}
            dates={options.scope === 'booking-day' ? [date] : bookingDates(booking)}
          />
        </TallSheet>
      ))}
    </PrintRoot>
  )
}

function PrintRoot({
  orientation,
  children,
}: {
  orientation: 'portrait' | 'landscape'
  children: ReactNode
}) {
  return (
    <div className={`print-only print-${orientation}`} aria-hidden>
      {children}
    </div>
  )
}

/** A sheet that flows: it grows down the page and breaks where it must. */
function TallSheet({ children }: { children: ReactNode }) {
  return (
    <section className="print-sheet print-sheet--flow" style={{ width: TALL_WIDTH }}>
      {children}
    </section>
  )
}

/**
 * A sheet that must land on exactly one page.
 *
 * It is laid out at a chosen width, measured, and scaled down as a whole so
 * every proportion survives. The catch is that a week of schools is always
 * limited by its height, and scaling on height alone leaves half the paper
 * blank — so when there is width to spare the layout is widened first and
 * measured again. A couple of passes is enough to land on a full page.
 */
function WideSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ width: WIDE_WIDTH, scale: 1 })
  const passes = useRef(0)

  useLayoutEffect(() => {
    passes.current = 0
  }, [children])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    // Transforms don't change the border box, so measuring the unscaled
    // content can't feed back into itself.
    const measure = () => {
      const height = element.scrollHeight
      if (height <= 0) return

      const byHeight = WIDE_HEIGHT / height
      const byWidth = WIDE_WIDTH / layout.width

      if (byHeight < byWidth && passes.current < 4) {
        const wanted = Math.min(WIDE_WIDTH * 3, Math.round(WIDE_WIDTH / byHeight))
        if (wanted > layout.width + 8) {
          passes.current += 1
          setLayout({ width: wanted, scale: Math.min(1, byHeight, byWidth) })
          return
        }
      }

      const scale = Number(Math.min(1, byHeight, byWidth).toFixed(4))
      if (Math.abs(scale - layout.scale) > 0.0005) {
        setLayout((current) => ({ ...current, scale }))
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children, layout.width, layout.scale])

  return (
    <section
      className="print-sheet print-sheet--fixed"
      style={{ width: WIDE_WIDTH, height: WIDE_HEIGHT }}
    >
      <div
        ref={ref}
        style={{
          width: layout.width,
          transform: layout.scale === 1 ? undefined : `scale(${layout.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </section>
  )
}

// ─── the school handout ─────────────────────────────────────────────────────

function ItinerarySheet({
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

  const detail = [
    booking.yearLevel,
    booking.packageTier === 'custom' ? '' : titleCase(booking.packageTier),
    booking.building,
    booking.studentCount ? `${booking.studentCount} students` : '',
  ]
    .filter(Boolean)
    .join('  ·  ')

  const teacherLed = blocks.some((block) => block.delivery === 'teacher_led')

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[27px] leading-[1.15] font-semibold tracking-[-0.01em] text-black">
          {booking.schoolName}
        </h1>
        <p className="mt-1.5 text-[14px] text-neutral-600">
          {formatDateRangeLong(days[0], days[days.length - 1])}
        </p>
        {detail && <p className="mt-0.5 text-[12.5px] text-neutral-500">{detail}</p>}
      </header>

      {booking.notes && (
        <p className="mb-5 border-l-2 border-neutral-300 pl-3 text-[12px] leading-relaxed text-neutral-600">
          {booking.notes}
        </p>
      )}

      <div className="space-y-6">
        {days.map((day) => (
          <DayTable
            key={day}
            booking={booking}
            date={day}
            blocks={blocks.filter((b) => b.date === day)}
            activities={activities}
            size="comfortable"
          />
        ))}
      </div>

      <footer className="mt-7 border-t border-neutral-200 pt-2 text-[10.5px] text-neutral-400">
        {[teacherLed ? 'TL = Teacher Led' : '', programName].filter(Boolean).join('  ·  ')}
      </footer>
    </>
  )
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// ─── one day ────────────────────────────────────────────────────────────────

interface Size {
  day: number
  head: number
  body: number
  time: number
  padY: string
  timeColumn: number
}

const SIZES: Record<'comfortable' | 'compact', Size> = {
  comfortable: { day: 15, head: 10.5, body: 13, time: 12, padY: '7px', timeColumn: 76 },
  compact: { day: 11, head: 8.5, body: 10, time: 9.5, padY: '3px', timeColumn: 54 },
}

function DayTable({
  booking, date, blocks, activities, size, showHeading = true,
}: {
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  size: 'comfortable' | 'compact'
  /** Off on the holistic sheet, where the date heads the whole band. */
  showHeading?: boolean
}) {
  const groupIds = useMemo(() => booking.groups.map((g) => g.id), [booking.groups])
  const rows = useMemo(() => buildDayRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  const s = SIZES[size]
  const columns = Math.max(booking.groups.length, 1)
  const names = booking.groups.length > 0 ? booking.groups.map((g) => g.name) : ['Group 1']
  // A single group needs no column heading — the whole table is that group.
  const showGroupRow = columns > 1

  return (
    <section className="print-keep">
      {showHeading && (
        <h2
          className="mb-1.5 font-semibold text-black"
          style={{ fontSize: s.day, letterSpacing: '-0.005em' }}
        >
          {formatDateLong(date)}
        </h2>
      )}

      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: s.timeColumn }} />
          {names.map((name) => (
            <col key={name} style={{ width: `calc((100% - ${s.timeColumn}px) / ${columns})` }} />
          ))}
        </colgroup>

        {showGroupRow && (
          <thead>
            <tr>
              <th className="border-b border-neutral-300 pb-1" />
              {names.map((name) => (
                <th
                  key={name}
                  className="border-b border-neutral-300 pb-1 pl-2 text-left font-medium text-neutral-500"
                  style={{ fontSize: s.head }}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {rows.map((row) => (
            <tr key={row.startMin} className="align-top">
              <td
                className="border-b border-neutral-100 pr-2 tabular-nums whitespace-nowrap text-neutral-500"
                style={{ fontSize: s.time, paddingTop: s.padY, paddingBottom: s.padY }}
              >
                {formatTimeFull(row.startMin)}
              </td>
              {row.cells.map((cell, index) => {
                const colour = cell.block ? exportFill(cell.block, activities) : undefined
                const wholeSchool = cell.span === columns
                return (
                  <td
                    key={index}
                    colSpan={cell.span}
                    className="border-b border-neutral-100 pl-2"
                    style={{ paddingTop: s.padY, paddingBottom: s.padY }}
                  >
                    {cell.block && (
                      <Cell
                        block={cell.block}
                        activities={activities}
                        colour={colour}
                        quiet={wholeSchool && !colour}
                        size={s}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/**
 * One session.
 *
 * Activities get a wash of their colour with a solid edge in the same hue; the
 * shape of the day — meals, bags, departure — gets no fill at all, which is how
 * these itineraries have always read and what stops the page turning into a
 * patchwork.
 */
function Cell({
  block, activities, colour, quiet, size,
}: {
  block: Block
  activities: Map<string, Activity>
  colour: string | undefined
  quiet: boolean
  size: Size
}) {
  const activity = block.activityId ? activities.get(block.activityId) : undefined
  const title = blockTitle(block, activity)
  const [heading, ...rest] = title.split('\n')

  return (
    <span
      className="flex items-baseline gap-1.5"
      style={
        colour
          ? {
              background: mix(colour, '#ffffff', 0.86),
              borderLeft: `3px solid ${colour}`,
              borderRadius: 2,
              padding: `2px 6px`,
              marginLeft: -6,
            }
          : undefined
      }
    >
      <span className="min-w-0 flex-1">
        <span
          className={quiet ? 'block leading-snug text-neutral-600' : 'block leading-snug text-black'}
          style={{ fontSize: size.body }}
        >
          {heading}
        </span>
        {rest.length > 0 && (
          <span
            className="block leading-snug whitespace-pre-line text-neutral-500"
            style={{ fontSize: size.body - 2 }}
          >
            {rest.join('\n')}
          </span>
        )}
        {block.note && (
          <span
            className="block leading-snug text-neutral-500 italic"
            style={{ fontSize: size.body - 2 }}
          >
            {block.note}
          </span>
        )}
      </span>
    </span>
  )
}

// ─── the holistic sheet ─────────────────────────────────────────────────────

function HolisticSheet({
  bookings, days, blocks, activities, title, subtitle, programName,
}: {
  bookings: Booking[]
  days: string[]
  blocks: Block[]
  activities: Map<string, Activity>
  title: string
  subtitle: string
  programName: string
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

  if (bands.length === 0) {
    return <p className="p-6 text-[13px]">No school is on site in {title}.</p>
  }

  const schools = new Set(bands.flatMap((band) => band.schools.map((s) => s.id))).size
  // Every day gets the same column width, so the sheet lines up down the page
  // and a quiet Monday doesn't stretch two schools across the whole sheet.
  const columns = Math.max(...bands.map((band) => band.schools.length), 1)

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-black">
            {title}
          </h1>
          <p className="mt-0.5 text-[12px] text-neutral-500">{subtitle}</p>
        </div>
        <p className="shrink-0 text-[11px] text-neutral-400">
          {schools} school{schools === 1 ? '' : 's'} · {programName}
        </p>
      </header>

      <div className="space-y-4">
        {bands.map((band) => (
          <div key={band.date} className="print-keep">
            <h2 className="mb-1.5 border-b border-neutral-300 pb-1 text-[13px] font-semibold text-black">
              {formatDateLong(band.date)}
            </h2>
            <div
              className="grid items-start gap-x-6"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {band.schools.map((booking) => (
                <div key={booking.id} className="min-w-0">
                  <p className="truncate text-[11px] leading-tight font-semibold text-black">
                    {booking.schoolName}
                  </p>
                  <p className="mb-1 truncate text-[9.5px] leading-tight text-neutral-500">
                    {[booking.yearLevel, booking.building].filter(Boolean).join(' · ') || ' '}
                  </p>
                  <DayTable
                    booking={booking}
                    date={band.date}
                    blocks={blocks.filter(
                      (b) => b.bookingId === booking.id && b.date === band.date,
                    )}
                    activities={activities}
                    size="compact"
                    showHeading={false}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-4 border-t border-neutral-200 pt-1.5 text-[9.5px] text-neutral-400">
        TL = Teacher Led
      </footer>
    </>
  )
}
