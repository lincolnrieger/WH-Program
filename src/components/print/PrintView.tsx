import { useMemo } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { blockTitle, bookingDates, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate, formatTime } from '@/lib/time'

interface Row {
  startMin: number
  /** One entry per group column; null means "covered by a span above". */
  cells: ({ block: Block; span: number } | null)[]
  /** A block covering every group renders as a single full-width row. */
  full?: { block: Block }
}

/**
 * Print layout, deliberately close to the existing handout: time down the left,
 * a column per group, and whole-school items merged across the full width.
 */
export function PrintView({
  bookings,
  blocks,
  activities,
  programName,
}: {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  programName: string
}) {
  return (
    <div className="print-only bg-white text-black">
      {bookings.map((booking) => (
        <BookingSheet
          key={booking.id}
          booking={booking}
          blocks={blocks.filter((b) => b.bookingId === booking.id)}
          activities={activities}
          programName={programName}
        />
      ))}
    </div>
  )
}

function BookingSheet({
  booking, blocks, activities, programName,
}: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  programName: string
}) {
  const dates = bookingDates(booking)

  return (
    <div className="print-page px-2 py-3">
      <header className="mb-3 border-b-2 border-black pb-1.5">
        <h1 className="text-[15px] font-bold">{bookingHeadline(booking)}</h1>
        <p className="text-[11px]">
          {bookingSubhead(booking)} · {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
        </p>
        <p className="text-[9px] text-neutral-600">
          {programName} · TL = Teacher-Led · printed {new Date().toLocaleDateString('en-AU')}
        </p>
      </header>

      {dates.map((date, index) => (
        <DayTable
          key={date}
          booking={booking}
          date={date}
          dayNumber={index + 1}
          blocks={blocks.filter((b) => b.date === date)}
          activities={activities}
        />
      ))}
    </div>
  )
}

function DayTable({
  booking, date, dayNumber, blocks, activities,
}: {
  booking: Booking
  date: string
  dayNumber: number
  blocks: Block[]
  activities: Map<string, Activity>
}) {
  const groupIds = booking.groups.map((g) => g.id)

  const rows = useMemo(() => buildRows(blocks, groupIds), [blocks, groupIds])
  if (rows.length === 0) return null

  return (
    <table className="print-keep mb-4 w-full border-collapse text-[10px]">
      <caption className="mb-1 text-left text-[11px] font-bold">
        Day {dayNumber} — {formatDate(date)}
      </caption>
      <thead>
        <tr>
          <th className="w-[62px] border border-neutral-400 bg-neutral-100 px-1 py-0.5 text-left">
            Time
          </th>
          {booking.groups.map((group) => (
            <th
              key={group.id}
              className="border border-neutral-400 bg-neutral-100 px-1 py-0.5 text-left"
            >
              {group.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.startMin}>
            <td className="border border-neutral-400 px-1 py-0.5 align-top whitespace-nowrap tabular-nums">
              {formatTime(row.startMin)}
            </td>

            {row.full ? (
              <td
                colSpan={Math.max(booking.groups.length, 1)}
                className="border border-neutral-400 px-1 py-0.5 align-top"
                style={{ background: tint(row.full.block, activities) }}
              >
                <span className="whitespace-pre-line">
                  {blockTitle(row.full.block, lookup(row.full.block, activities))}
                </span>
              </td>
            ) : (
              row.cells.map((cell, index) =>
                cell === null ? null : (
                  <td
                    key={index}
                    colSpan={cell.span}
                    className="border border-neutral-400 px-1 py-0.5 align-top"
                    style={{ background: tint(cell.block, activities) }}
                  >
                    <span className="whitespace-pre-line">
                      {blockTitle(cell.block, lookup(cell.block, activities))}
                    </span>
                    {cell.block.staffIds.length > 0 && (
                      <span className="block text-[8.5px] text-neutral-600">
                        {cell.block.staffIds.length} staff
                      </span>
                    )}
                  </td>
                ),
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function lookup(block: Block, activities: Map<string, Activity>): Activity | undefined {
  return block.activityId ? activities.get(block.activityId) : undefined
}

/** Pale wash of the activity colour — enough to group by eye, still printable. */
function tint(block: Block, activities: Map<string, Activity>): string {
  const colour = block.colour ?? lookup(block, activities)?.colour
  if (!colour) return 'transparent'
  return `color-mix(in srgb, ${colour} 22%, white)`
}

/**
 * Collapses the free-form blocks back into the row-per-start-time grid the
 * printed handout uses. Blocks that share a start time sit on one row; blocks
 * covering every group become a merged full-width row.
 */
function buildRows(blocks: Block[], groupIds: string[]): Row[] {
  const indexOf = new Map(groupIds.map((id, index) => [id, index]))
  const starts = [...new Set(blocks.map((b) => b.startMin))].sort((a, b) => a - b)

  return starts.map((startMin) => {
    const atTime = blocks.filter((b) => b.startMin === startMin)

    const wholeSchool = atTime.find(
      (block) => groupIds.length > 0 && block.groupIds.length >= groupIds.length,
    )
    if (wholeSchool && atTime.length === 1) {
      return { startMin, cells: [], full: { block: wholeSchool } }
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

    return { startMin, cells }
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
