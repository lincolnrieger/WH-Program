import { useMemo } from 'react'
import type { Activity, Block, Booking, StaffMember, Venue } from '@/types'
import { blockTitle, bookingDates, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate, formatDateNumeric, formatTime, formatTimeFull } from '@/lib/time'
import { mix } from '@/lib/colour'

export type PrintScope = 'booking' | 'site-day' | 'site-week'

export interface PrintOptions {
  scope: PrintScope
  showStaff: boolean
  showVenues: boolean
  showLegend: boolean
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  scope: 'booking',
  showStaff: true,
  showVenues: false,
  showLegend: true,
}

interface Row {
  startMin: number
  endMin: number
  cells: ({ block: Block; span: number } | null)[]
  full?: Block
}

/**
 * The printed itinerary.
 *
 * Laid out like the handout it replaces — time down the left, a column per
 * group, whole-school items merged across — but with the activity colours as
 * pale washes, a proper header block, and each day kept on one page where it
 * fits.
 */
export function PrintView({
  bookings, blocks, activities, venues, staff, programName, options, siteName, date,
}: {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  programName: string
  options: PrintOptions
  siteName: string
  date: string
}) {
  return (
    <div className="print-only bg-white text-black">
      {bookings.map((booking, index) => (
        <BookingSheet
          key={booking.id}
          booking={booking}
          blocks={blocks.filter((b) => b.bookingId === booking.id)}
          activities={activities}
          venues={venues}
          staff={staff}
          programName={programName}
          siteName={siteName}
          options={options}
          dates={
            options.scope === 'site-day'
              ? [date]
              : bookingDates(booking).filter((d) =>
                  options.scope === 'booking' ? true : d >= date,
                )
          }
          last={index === bookings.length - 1}
        />
      ))}
      {bookings.length === 0 && (
        <p className="p-6 text-[12px]">Nothing scheduled to print.</p>
      )}
    </div>
  )
}

function BookingSheet({
  booking, blocks, activities, venues, staff, programName, siteName, options, dates, last,
}: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
  programName: string
  siteName: string
  options: PrintOptions
  dates: string[]
  last: boolean
}) {
  const days = dates.filter((date) => blocks.some((b) => b.date === date))

  const usedActivities = useMemo(() => {
    const seen = new Map<string, Activity>()
    for (const block of blocks) {
      if (!block.activityId || !days.includes(block.date)) continue
      const activity = activities.get(block.activityId)
      if (activity) seen.set(activity.id, activity)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [blocks, days, activities])

  if (days.length === 0) return null

  return (
    <section className={last ? '' : 'print-page'}>
      <header className="mb-3 flex items-end justify-between gap-4 border-b-[2.5px] border-black pb-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            {siteName} · Itinerary
          </p>
          <h1 className="mt-0.5 text-[17px] leading-tight font-bold">
            {bookingHeadline(booking)}
          </h1>
          <p className="text-[11px] text-neutral-700">{bookingSubhead(booking)}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] leading-snug text-neutral-700">
          <p className="font-semibold text-black">
            {formatDateNumeric(booking.startDate)} – {formatDateNumeric(booking.endDate)}
          </p>
          <p>
            {booking.groups.length} group{booking.groups.length === 1 ? '' : 's'}
            {booking.studentCount ? ` · ${booking.studentCount} students` : ''}
          </p>
          <p className="text-neutral-500">TL = Teacher-Led</p>
        </div>
      </header>

      {booking.notes && (
        <p className="mb-3 border-l-[3px] border-neutral-300 pl-2 text-[10px] text-neutral-700">
          {booking.notes}
        </p>
      )}

      {days.map((date, index) => (
        <DayTable
          key={date}
          booking={booking}
          date={date}
          dayNumber={dates.indexOf(date) + 1}
          totalDays={dates.length}
          blocks={blocks.filter((b) => b.date === date)}
          activities={activities}
          venues={venues}
          staff={staff}
          options={options}
          first={index === 0}
        />
      ))}

      {options.showLegend && usedActivities.length > 0 && (
        <div className="print-keep mt-3 border-t border-neutral-300 pt-2">
          <p className="mb-1 text-[8.5px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
            Activities this stay
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
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

      <footer className="mt-2 flex justify-between text-[8px] text-neutral-400">
        <span>{programName}</span>
        <span>Printed {new Date().toLocaleDateString('en-AU')}</span>
      </footer>
    </section>
  )
}

function DayTable({
  booking, date, dayNumber, totalDays, blocks, activities, venues, staff, options, first,
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
  first: boolean
}) {
  const groupIds = booking.groups.map((g) => g.id)
  const rows = useMemo(() => buildRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  const columns = Math.max(booking.groups.length, 1)

  return (
    <div className={first ? 'print-keep mb-4' : 'print-keep mb-4'}>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-[12px] font-bold">
          Day {dayNumber}
          {totalDays > 1 ? ` of ${totalDays}` : ''}
        </h2>
        <span className="text-[11px] text-neutral-700">{formatDate(date)}</span>
      </div>

      <table className="w-full border-collapse text-[9.5px]" style={{ tableLayout: 'fixed' }}>
        {/* Fixed time gutter, then the remaining width split evenly — percentages
            alone would overflow once the gutter is added. */}
        <colgroup>
          <col style={{ width: '64px' }} />
          {booking.groups.map((group) => (
            <col key={group.id} style={{ width: `calc((100% - 64px) / ${columns})` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-neutral-400 bg-neutral-100 px-1.5 py-1 text-left text-[9px] font-semibold">
              Time
            </th>
            {booking.groups.map((group) => (
              <th
                key={group.id}
                className="border border-neutral-400 bg-neutral-100 px-1.5 py-1 text-left text-[9px] font-semibold"
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
              <td className="border border-neutral-400 px-1.5 py-1 align-top">
                <span className="block font-semibold tabular-nums">{formatTime(row.startMin)}</span>
                <span className="block text-[8px] tabular-nums text-neutral-500">
                  {formatTimeFull(row.endMin)}
                </span>
              </td>

              {row.full ? (
                <td
                  colSpan={columns}
                  className="border border-neutral-400 px-1.5 py-1 align-top"
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
                      className="border border-neutral-400 px-1.5 py-1 align-top"
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
  const staffNames = options.showStaff
    ? block.staffIds.map((id) => staff.get(id)?.name ?? id)
    : []
  const venueName = options.showVenues && block.venueId ? venues.get(block.venueId)?.name : undefined

  return (
    <>
      <span className="block leading-snug font-medium whitespace-pre-line">
        {blockTitle(block, activity)}
      </span>
      {(venueName || staffNames.length > 0) && (
        <span className="mt-0.5 block text-[8px] leading-tight text-neutral-600">
          {[venueName, staffNames.join(', ')].filter(Boolean).join(' · ')}
        </span>
      )}
      {block.note && (
        <span className="mt-0.5 block text-[8px] leading-tight text-neutral-500 italic">
          {block.note}
        </span>
      )}
    </>
  )
}

/** Pale wash of the activity colour — groups by eye without eating toner. */
function tint(block: Block, activities: Map<string, Activity>): string {
  const colour =
    block.colour ?? (block.activityId ? activities.get(block.activityId)?.colour : undefined)
  if (!colour) return 'transparent'
  return mix(colour, '#ffffff', 0.8)
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
