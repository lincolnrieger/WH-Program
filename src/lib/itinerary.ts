import type { Block, Booking } from '@/types'

/**
 * Turns the free-form blocks on the grid back into the row-per-start-time table
 * the itinerary sheets use.
 *
 * Both the printed sheets and the Excel export read from here, so the two can't
 * drift apart: a row is a start time, a cell covers one or more group columns,
 * and a block that applies to the whole school becomes one cell spanning them
 * all — the difference between "Lunch" written once and written six times.
 */

export interface DayCell {
  /** Absent for a column with nothing scheduled at this time. */
  block?: Block
  /** How many group columns this cell covers. */
  span: number
}

export interface DayRow {
  startMin: number
  endMin: number
  /** In column order; the spans always add up to the group count. */
  cells: DayCell[]
}

export function buildDayRows(blocks: Block[], groupIds: string[]): DayRow[] {
  const columns = Math.max(groupIds.length, 1)
  const indexOf = new Map(groupIds.map((id, index) => [id, index]))
  const starts = [...new Set(blocks.map((b) => b.startMin))].sort((a, b) => a - b)

  return starts.map((startMin) => {
    const atTime = blocks.filter((b) => b.startMin === startMin)
    const endMin = Math.max(...atTime.map((b) => b.endMin))

    // Widest block first, so a whole-school item claims its span before a
    // single-group one can take the column it starts in.
    const ordered = [...atTime].sort((a, b) => b.groupIds.length - a.groupIds.length)

    const placed = new Array<Block | undefined>(columns).fill(undefined)
    const spans = new Array<number>(columns).fill(0)

    for (const block of ordered) {
      const indices = block.groupIds
        .map((id) => indexOf.get(id))
        .filter((index): index is number => index !== undefined)
      if (indices.length === 0) continue

      const start = Math.min(...indices)
      const span = Math.max(...indices) - start + 1
      // Anything overlapping a cell already taken is dropped from the table —
      // it is still on the grid, it just can't be drawn twice in one row.
      let free = true
      for (let i = start; i < start + span; i += 1) if (placed[i] || spans[i]) free = false
      if (!free) continue

      placed[start] = block
      spans[start] = span
      for (let i = start + 1; i < start + span; i += 1) spans[i] = -1
    }

    const cells: DayCell[] = []
    for (let i = 0; i < columns; i += 1) {
      if (spans[i] === -1) continue
      if (spans[i] > 0) cells.push({ block: placed[i], span: spans[i] })
      else cells.push({ span: 1 })
    }
    return { startMin, endMin, cells }
  })
}

/** Days of a stay that have anything on them, in order. */
export function daysWithBlocks(booking: Booking, blocks: Block[], dates: string[]): string[] {
  const forBooking = blocks.filter((b) => b.bookingId === booking.id)
  return dates.filter((date) => forBooking.some((b) => b.date === date))
}

/** Every school on site on a given day, in start-date order. */
export function bookingsOnDate(bookings: Booking[], date: string): Booking[] {
  return bookings
    .filter((b) => date >= b.startDate && date <= b.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.schoolName.localeCompare(b.schoolName))
}
