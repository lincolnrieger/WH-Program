import type { Activity, Block, Booking, Site } from '@/types'
import { SITES } from '@/types'
import { readableText } from './colour'
import {
  blockTitle, bookingDates, bookingHeadline, bookingSubhead, downloadFile, exportFill, safeName,
} from './exportImport'
import { bookingsOnDate, buildDayRows, daysWithBlocks } from './itinerary'
import { termWeekOfWeek } from './term'
import {
  buildWorkbook, cellRef, type Cell, type CellStyle, type Sheet, type SheetRow,
} from './xlsx'
import {
  addDays, dateRange, formatDateNumeric, formatTimeFull, startOfWeek, weekdayShort,
} from './time'

/**
 * Excel exports shaped like the itineraries they replace.
 *
 * Two sheets, both modelled on the workbooks the program team already sends
 * out. The **holistic** sheet stacks the days down the page and puts the
 * schools side by side, each with its own time column — so one page shows
 * everybody who is on site and what they are doing. The **school itinerary**
 * is the single-school handout: a header, a note that TL means teacher led,
 * then a table per day with a column per group.
 *
 * Activity cells carry their colour through from the colour key. Meals and
 * logistics are left unfilled, which is how they appear on the existing sheets.
 */

const TIME_COLUMN_WIDTH = 12
const GROUP_COLUMN_WIDTH = 21

const BORDER: CellStyle = { border: true, valign: 'center' }
const DAY_STYLE: CellStyle = { ...BORDER, bold: true, size: 14 }
const DATE_STYLE: CellStyle = { ...BORDER, bold: true, size: 11 }
const SCHOOL_STYLE: CellStyle = { ...BORDER, bold: true, size: 11, wrap: true }
const GROUP_STYLE: CellStyle = { ...BORDER, bold: true, size: 10, align: 'center' }
const TIME_STYLE: CellStyle = { ...BORDER, bold: true, size: 10 }
const BLANK_STYLE: CellStyle = { border: true }

const CONTENT_ROW_HEIGHT = 30
const ROUTINE_ROW_HEIGHT = 18

function contentStyle(fill: string | undefined): CellStyle {
  return {
    border: true,
    wrap: true,
    valign: 'center',
    size: 10,
    ...(fill ? { fill, colour: readableText(fill) } : {}),
  }
}

/** Writes `cell` at `column`, growing the row to fit. */
function put(row: (Cell | undefined)[], column: number, cell: Cell): void {
  while (row.length < column) row.push(undefined)
  row[column] = cell
}

function siteShort(site: Site): string {
  return SITES.find((s) => s.id === site)?.short ?? 'Woodhouse'
}

// ─── the holistic sheet ─────────────────────────────────────────────────────

/**
 * One school's slice of a day: its own time column plus a column per group.
 *
 * Laying each school out with its own times is what makes the sheet work —
 * a day visit arriving at 9.45 and a camp starting at 7.30 don't share a
 * clock, and forcing them onto one would leave the page full of holes.
 */
interface SchoolBlockLayout {
  booking: Booking
  /** Zero-based sheet column of this school's time column. */
  timeColumn: number
  groupColumns: number
  rows: ReturnType<typeof buildDayRows>
}

function layOutDay(
  bookings: Booking[],
  blocks: Block[],
  date: string,
): { schools: SchoolBlockLayout[]; width: number; height: number } {
  let column = 0
  const schools: SchoolBlockLayout[] = []

  for (const booking of bookings) {
    const groupColumns = Math.max(booking.groups.length, 1)
    schools.push({
      booking,
      timeColumn: column,
      groupColumns,
      rows: buildDayRows(
        blocks.filter((b) => b.bookingId === booking.id && b.date === date),
        booking.groups.map((g) => g.id),
      ),
    })
    column += 1 + groupColumns
  }

  return {
    schools,
    width: column,
    height: Math.max(0, ...schools.map((s) => s.rows.length)),
  }
}

function holisticSheet(input: {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  days: string[]
  title: string
}): Sheet {
  const { bookings, blocks, activities, days, title } = input

  const rows: SheetRow[] = []
  const merges: string[] = []
  let width = 1

  for (const date of days) {
    const present = bookingsOnDate(bookings, date)
    if (present.length === 0) continue

    const layout = layOutDay(present, blocks, date)
    if (layout.height === 0) continue
    width = Math.max(width, layout.width)

    const headerIndex = rows.length
    const headerCells: (Cell | undefined)[] = []
    const groupCells: (Cell | undefined)[] = []

    for (const school of layout.schools) {
      put(headerCells, school.timeColumn, { value: weekdayShort(date), style: DAY_STYLE })
      put(groupCells, school.timeColumn, { value: formatDateNumeric(date), style: DATE_STYLE })

      const headline = [bookingHeadline(school.booking), bookingSubhead(school.booking)]
        .filter(Boolean)
        .join('\n')
      put(headerCells, school.timeColumn + 1, { value: headline, style: SCHOOL_STYLE })
      // The school's name spans its groups, the way the header row reads on the
      // sheet this replaces.
      for (let i = 2; i <= school.groupColumns; i += 1) {
        put(headerCells, school.timeColumn + i, { style: SCHOOL_STYLE })
      }
      if (school.groupColumns > 1) {
        merges.push(
          `${cellRef(headerIndex, school.timeColumn + 1)}:${cellRef(headerIndex, school.timeColumn + school.groupColumns)}`,
        )
      }

      school.booking.groups.forEach((group, index) => {
        put(groupCells, school.timeColumn + 1 + index, { value: group.name, style: GROUP_STYLE })
      })
      if (school.booking.groups.length === 0) {
        put(groupCells, school.timeColumn + 1, { value: 'Group 1', style: GROUP_STYLE })
      }
    }

    rows.push({ cells: headerCells, height: 36 })
    rows.push({ cells: groupCells, height: 18 })

    // Schools rarely have the same number of rows; the short ones get bordered
    // blanks so the day still reads as one band.
    for (let line = 0; line < layout.height; line += 1) {
      const cells: (Cell | undefined)[] = []
      let tallest = ROUTINE_ROW_HEIGHT

      for (const school of layout.schools) {
        const row = school.rows[line]
        if (!row) {
          for (let i = 0; i <= school.groupColumns; i += 1) {
            put(cells, school.timeColumn + i, { style: BLANK_STYLE })
          }
          continue
        }

        put(cells, school.timeColumn, { value: formatTimeFull(row.startMin), style: TIME_STYLE })

        let column = school.timeColumn + 1
        for (const cell of row.cells) {
          const fill = cell.block ? exportFill(cell.block, activities) : undefined
          const activity = cell.block?.activityId ? activities.get(cell.block.activityId) : undefined
          put(cells, column, {
            value: cell.block ? blockTitle(cell.block, activity) : undefined,
            style: contentStyle(fill),
          })
          for (let i = 1; i < cell.span; i += 1) {
            put(cells, column + i, { style: contentStyle(fill) })
          }
          if (cell.span > 1) {
            merges.push(`${cellRef(rows.length, column)}:${cellRef(rows.length, column + cell.span - 1)}`)
          }
          if (cell.block?.title?.includes('\n') || (cell.block?.note ?? '').length > 0) {
            tallest = Math.max(tallest, 46)
          }
          column += cell.span
        }

        if (row.cells.some((cell) => cell.block?.kind === 'activity')) {
          tallest = Math.max(tallest, CONTENT_ROW_HEIGHT)
        }
      }

      rows.push({ cells, height: tallest })
    }

    rows.push({ cells: [] })
  }

  if (rows.length === 0) {
    rows.push({ cells: [{ value: `Nothing scheduled in ${title}.`, style: { bold: true } }] })
  }

  const columns = [TIME_COLUMN_WIDTH, ...Array.from({ length: width - 1 }, () => GROUP_COLUMN_WIDTH)]
  return { name: 'Holistic', rows, merges, columns, landscape: true }
}

// ─── one school's itinerary ─────────────────────────────────────────────────

function bookingSheet(input: {
  booking: Booking
  blocks: Block[]
  activities: Map<string, Activity>
  dates: string[]
}): Sheet {
  const { booking, blocks, activities, dates } = input
  const groupIds = booking.groups.map((g) => g.id)
  const columns = Math.max(groupIds.length, 1)

  const rows: SheetRow[] = []
  const merges: string[] = []

  const spanAll = (rowIndex: number) =>
    merges.push(`${cellRef(rowIndex, 1)}:${cellRef(rowIndex, columns)}`)

  // Header block, as on the school handout: name, dates, and the TL note.
  rows.push({ cells: [] })
  rows.push({
    cells: [undefined, { value: bookingHeadline(booking), style: { bold: true, size: 16 } }],
    height: 24,
  })
  spanAll(rows.length - 1)
  rows.push({
    cells: [
      undefined,
      {
        value: `${formatDateNumeric(booking.startDate)} – ${formatDateNumeric(booking.endDate)}${
          bookingSubhead(booking) ? ` · ${bookingSubhead(booking)}` : ''
        }`,
        style: { size: 11 },
      },
    ],
  })
  spanAll(rows.length - 1)
  rows.push({ cells: [undefined, { value: 'TL = Teacher Led', style: { size: 11 } }] })
  spanAll(rows.length - 1)
  if (booking.notes) {
    rows.push({ cells: [undefined, { value: booking.notes, style: { size: 10, italic: true, wrap: true } }] })
    spanAll(rows.length - 1)
  }
  rows.push({ cells: [] })

  for (const date of dates) {
    const dayBlocks = blocks.filter((b) => b.bookingId === booking.id && b.date === date)
    if (dayBlocks.length === 0) continue

    const header: (Cell | undefined)[] = [{ value: weekdayShort(date), style: DAY_STYLE }]
    booking.groups.forEach((group, index) => {
      header[index + 1] = { value: group.name, style: GROUP_STYLE }
    })
    if (booking.groups.length === 0) header[1] = { value: 'Group 1', style: GROUP_STYLE }
    rows.push({ cells: header, height: 22 })

    for (const row of buildDayRows(dayBlocks, groupIds)) {
      const cells: (Cell | undefined)[] = [
        { value: formatTimeFull(row.startMin), style: TIME_STYLE },
      ]
      let column = 1
      let height = ROUTINE_ROW_HEIGHT

      for (const cell of row.cells) {
        const fill = cell.block ? exportFill(cell.block, activities) : undefined
        const activity = cell.block?.activityId ? activities.get(cell.block.activityId) : undefined
        const text = cell.block
          ? [blockTitle(cell.block, activity), cell.block.note].filter(Boolean).join('\n')
          : undefined
        cells[column] = { value: text, style: contentStyle(fill) }
        for (let i = 1; i < cell.span; i += 1) {
          cells[column + i] = { style: contentStyle(fill) }
        }
        if (cell.span > 1) {
          merges.push(`${cellRef(rows.length, column)}:${cellRef(rows.length, column + cell.span - 1)}`)
        }
        if (cell.block?.kind === 'activity') height = Math.max(height, CONTENT_ROW_HEIGHT)
        if (text?.includes('\n')) height = Math.max(height, 46)
        column += cell.span
      }

      rows.push({ cells, height })
    }

    rows.push({ cells: [] })
  }

  if (rows.length <= 5) {
    rows.push({ cells: [undefined, { value: 'Nothing scheduled yet.', style: { italic: true } }] })
  }

  return {
    name: booking.schoolName || 'Itinerary',
    rows,
    merges,
    columns: [TIME_COLUMN_WIDTH, ...Array.from({ length: columns }, () => GROUP_COLUMN_WIDTH)],
    landscape: columns > 3,
  }
}

// ─── the colour key ─────────────────────────────────────────────────────────

/**
 * The "Activities Colour Key" tab, so whoever opens the workbook can see what
 * each fill means without having the app in front of them.
 */
function colourKeySheet(activities: Activity[]): Sheet {
  const rows: SheetRow[] = [
    { cells: [{ value: 'Activities Colour Key', style: { bold: true, size: 14 } }], height: 22 },
    { cells: [] },
  ]

  for (const activity of activities) {
    rows.push({
      cells: [
        {
          value: activity.name,
          style: { ...contentStyle(activity.colour), wrap: false },
        },
        { value: activity.colour.toUpperCase(), style: { size: 9, colour: '#777777' } },
      ],
      height: 18,
    })
  }

  return { name: 'Activities Colour Key', rows, columns: [30, 12], landscape: false }
}

// ─── entry points ───────────────────────────────────────────────────────────

export interface ExportInput {
  bookings: Booking[]
  blocks: Block[]
  activities: Map<string, Activity>
  activityList: Activity[]
  site: Site
}

/** Sheets for the whole site over the week containing `date`, plus the colour key. */
export function holisticSheets(input: ExportInput & { date: string }): {
  sheets: Sheet[]
  filename: string
} {
  const weekStart = startOfWeek(input.date)
  const days = dateRange(weekStart, addDays(weekStart, 6))
  const term = termWeekOfWeek(weekStart)

  const sheet = holisticSheet({
    bookings: input.bookings,
    blocks: input.blocks,
    activities: input.activities,
    days,
    title: term.label,
  })

  const used = activitiesUsed(input, (block) => block.date >= days[0] && block.date <= days[6])
  return {
    sheets: [sheet, colourKeySheet(used.length > 0 ? used : input.activityList)],
    filename: `${safeName(siteShort(input.site))}-holistic-${safeName(term.label)}.xlsx`,
  }
}

/** One sheet per school, each laid out like the individual handout. */
export function bookingSheets(input: ExportInput): { sheets: Sheet[]; filename: string } {
  const sheets = input.bookings.map((booking) =>
    bookingSheet({
      booking,
      blocks: input.blocks,
      activities: input.activities,
      dates: daysWithBlocks(booking, input.blocks, bookingDates(booking)),
    }),
  )

  const ids = new Set(input.bookings.map((b) => b.id))
  const used = activitiesUsed(input, (block) => ids.has(block.bookingId))

  const name =
    input.bookings.length === 1
      ? `${safeName(input.bookings[0].schoolName)}-itinerary`
      : `${safeName(siteShort(input.site))}-itineraries`

  return { sheets: [...sheets, colourKeySheet(used)], filename: `${name}.xlsx` }
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function exportHolisticWorkbook(input: ExportInput & { date: string }): void {
  const { sheets, filename } = holisticSheets(input)
  downloadFile(filename, buildWorkbook(sheets), XLSX_TYPE)
}

export function exportBookingWorkbook(input: ExportInput): void {
  const { sheets, filename } = bookingSheets(input)
  if (sheets.length <= 1) return
  downloadFile(filename, buildWorkbook(sheets), XLSX_TYPE)
}

function activitiesUsed(input: ExportInput, keep: (block: Block) => boolean): Activity[] {
  const seen = new Map<string, Activity>()
  for (const block of input.blocks) {
    if (!block.activityId || !keep(block)) continue
    const activity = input.activities.get(block.activityId)
    if (activity) seen.set(activity.id, activity)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}
