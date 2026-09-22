import type { Activity, Block, Booking, Delivery, Group, PackageTier, Site } from '@/types'
import { ROUTINES } from '@/data/activities'
import { colourFromString } from './colour'
import { uid } from './id'
import { addDays, dateRange, daysBetween, parseTime } from './time'
import type { MergedRange, ReadCell, ReadSheet } from './xlsxRead'

/**
 * Reads the itinerary workbooks the program was run from before this app, and
 * turns them into bookings and sessions.
 *
 * Two layouts turn up, and both are handled: the **holistic** sheet, where the
 * days run down the page and the schools sit side by side each with its own
 * time column, and the **individual** handout, which is one school with a table
 * per day. A week folder usually contains both, describing the same stay twice,
 * so the parser reconciles them rather than importing a school twice.
 *
 * The sheets are hand-maintained, so this is deliberately forgiving: it repairs
 * am/pm slips in the time column, reads sessions that span merged cells in
 * either direction, and keeps any wording it doesn't recognise rather than
 * dropping the row.
 */

export interface ImportOptions {
  site: Site
  /** Activities that aren't in the catalogue are added to it, keeping their colour. */
  addUnknownActivities: boolean
}

export interface ImportedBooking {
  booking: Booking
  blocks: Block[]
  /** Files this stay was read from, for the preview. */
  sources: string[]
}

export interface ImportResult {
  bookings: ImportedBooking[]
  /** Activities seen in the sheets that aren't in the catalogue. */
  newActivities: Activity[]
  /** Files that were read, and what came out of each. */
  files: { name: string; layout: 'holistic' | 'individual' | 'none'; schools: number }[]
  warnings: string[]
}

const WEEKDAYS: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
  sun: 0, sunday: 0,
}

/** Minutes given to the last session of a day, which has no following row. */
const TRAILING_DURATION = 60

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The abbreviations these sheets shorten school names with. A week's holistic
 * sheet says "McLaren Flat PS" where the school's own handout says "McLaren
 * Flat Primary School", and without expanding them the same stay is imported
 * twice.
 */
const NAME_EXPANSIONS: Record<string, string> = {
  ps: 'primaryschool', pps: 'primaryschool', hs: 'highschool',
  shs: 'seniorhighschool', cc: 'catholiccollege', coll: 'college',
  sch: 'school', pri: 'primary', st: 'saint', ck: 'catholic',
}

/** Key a school by, with abbreviations expanded so the variants line up. */
function schoolKey(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => NAME_EXPANSIONS[word] ?? word)
    .join('')
}

/** Whether two school keys are the same school written two ways. */
function sameSchool(a: string, b: string): boolean {
  if (a === b) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.length >= 8 && longer.startsWith(shorter)
}

function weekdayOf(text: string | undefined): number | undefined {
  if (!text) return undefined
  return WEEKDAYS[text.trim().toLowerCase().replace(/[^a-z]/g, '')]
}

function isGroupHeading(text: string | undefined): boolean {
  return Boolean(text && /^group\b/i.test(text.trim()))
}

// ─── times ──────────────────────────────────────────────────────────────────

/**
 * Reads a column of hand-typed times into minutes, repairing the am/pm slips
 * these sheets are full of.
 *
 * "11.30pm" sitting between recess and lunch means 11:30am, and the only way to
 * know that is the company it keeps — so each value is resolved to whichever of
 * its readings keeps the day running forwards.
 */
export function readDayTimes(raw: (string | undefined)[]): (number | undefined)[] {
  const out: (number | undefined)[] = []
  let previous: number | undefined

  for (const text of raw) {
    const parsed = text === undefined ? null : parseTime(startOfRange(text))
    if (parsed === null || parsed === undefined) {
      out.push(undefined)
      continue
    }

    const candidates = [parsed, parsed + 720, parsed - 720].filter(
      (value) => value >= 5 * 60 && value <= 23 * 60,
    )
    if (candidates.length === 0) {
      out.push(parsed)
      previous = parsed
      continue
    }

    let chosen: number
    if (previous === undefined) {
      // The first row of a day: prefer the reading nearest a normal start.
      chosen = candidates.reduce((best, value) =>
        Math.abs(value - 10 * 60) < Math.abs(best - 10 * 60) ? value : best,
      )
    } else {
      const forward = candidates.filter((value) => value >= previous!)
      chosen = forward.length
        ? Math.min(...forward)
        : candidates.reduce((best, value) =>
            Math.abs(value - previous!) < Math.abs(best - previous!) ? value : best,
          )
    }

    out.push(chosen)
    previous = chosen
  }

  return out
}

/** "1pm - 2pm" and "1 - 2pm" both start at one o'clock. */
function startOfRange(text: string): string {
  const match = /^(.+?)\s*[-–—]\s*(.+)$/.exec(text.trim())
  if (!match) return text.trim()
  const left = match[1].trim()
  // "1 - 2pm": the meridiem is only written once, at the end.
  if (!/[ap]\.?m/i.test(left)) {
    const meridiem = /([ap])\.?m/i.exec(match[2])?.[1]
    if (meridiem) return `${left}${meridiem}m`
  }
  return left
}

/** The end of "1pm - 2pm", when the row says one. */
function endOfRange(text: string): number | null {
  const match = /^(.+?)\s*[-–—]\s*(.+)$/.exec(text.trim())
  if (!match) return null
  return parseTime(match[2].trim())
}

// ─── classifying a cell ─────────────────────────────────────────────────────

interface Classified {
  kind: Block['kind']
  activityId?: string
  title?: string
  delivery: Delivery
  colour?: string
  /** Set when the label isn't in the catalogue and should be added to it. */
  newActivity?: { name: string; colour: string }
}

/**
 * Phrases that are the shape of a camp day rather than an activity. Matched on
 * the first line, by prefix, because the sheets append detail to them —
 * "Breakfast / Pack bags, clean building…" is still breakfast.
 */
const ROUTINE_PREFIXES: { match: RegExp; routineId: string }[] = [
  { match: /^breakfast/i, routineId: 'breakfast' },
  { match: /^morning tea/i, routineId: 'morning-tea' },
  { match: /^lunch/i, routineId: 'lunch' },
  { match: /^afternoon tea/i, routineId: 'afternoon-tea' },
  { match: /^dinner/i, routineId: 'dinner' },
  { match: /^(recess|supper)/i, routineId: 'recess' },
  { match: /^arriv/i, routineId: 'arrival' },
  { match: /^(departure|depart|prepare for)/i, routineId: 'departure' },
  { match: /^move bags/i, routineId: 'bags-to-dorms' },
  { match: /^pack bags/i, routineId: 'pack-clean' },
  { match: /^free time/i, routineId: 'free-time' },
  { match: /^evening activit/i, routineId: 'evening-activities' },
]

function splitDelivery(label: string): { base: string; delivery: Delivery } {
  const teacher = /\s[-–]\s*(tl|teacher led)\s*$/i
  const self = /\s[-–]\s*(sl|self led)\s*$/i
  if (teacher.test(label)) return { base: label.replace(teacher, '').trim(), delivery: 'teacher_led' }
  if (self.test(label)) return { base: label.replace(self, '').trim(), delivery: 'self_led' }
  return { base: label.trim(), delivery: 'staff' }
}

/**
 * Works out what one cell means.
 *
 * A name that matches the catalogue outright wins. Failing that, a name that
 * *extends* a catalogue one — "Tube Slide OR", "Challenge Hill (Dry)" — counts
 * as that activity when the cell's colour agrees, which keeps the original
 * wording while still pointing at the right thing. Colour alone is never
 * enough: several activities share a fill, and "Solo" printed in Nature
 * Handicraft's yellow is still not Nature Handicraft.
 */
export function classifyCell(
  text: string,
  fill: string | undefined,
  catalogue: Activity[],
): Classified {
  const firstLine = text.split('\n')[0].trim()
  const { base, delivery } = splitDelivery(firstLine)

  const routine = ROUTINE_PREFIXES.find((entry) => entry.match.test(base))
  if (routine) {
    const template = ROUTINES.find((r) => r.id === routine.routineId)
    return {
      kind: template?.kind ?? 'logistics',
      title: text,
      delivery,
      colour: template?.colour,
    }
  }

  const key = normalise(base)
  const exact = catalogue.find((activity) => normalise(activity.name) === key)
  if (exact) {
    return {
      kind: 'activity',
      activityId: exact.id,
      delivery,
      title: normalise(firstLine) === normalise(exact.name) ? undefined : text,
    }
  }

  if (fill && isColour(fill)) {
    const sameColour = catalogue.filter((activity) => activity.colour.toLowerCase() === fill)
    const extended = sameColour.filter((activity) => key.startsWith(normalise(activity.name)))
    if (extended.length === 1) {
      return { kind: 'activity', activityId: extended[0].id, delivery, title: text }
    }
  }

  return {
    kind: 'activity',
    delivery,
    title: text,
    newActivity: { name: base || firstLine, colour: isColour(fill) ? fill! : colourFromString(base) },
  }
}

/** White and black are the sheet's "nothing here" fills, not activity colours. */
function isColour(fill: string | undefined): fill is string {
  if (!fill) return false
  const hex = fill.toLowerCase()
  return hex !== '#ffffff' && hex !== '#000000' && hex !== '#fff' && hex !== '#000'
}

// ─── reading a sheet ────────────────────────────────────────────────────────

interface RawSession {
  /** Index of the group column this session starts in, relative to the school. */
  column: number
  columnSpan: number
  startMin: number
  endMin: number
  text: string
  fill?: string
}

interface RawDay {
  date?: string
  weekday: number
  groups: string[]
  headline?: string
  sessions: RawSession[]
}

interface RawStay {
  headline: string
  days: RawDay[]
  /** Set by the individual layout, which states the stay's dates in its header. */
  statedDates?: { start: string; end: string }
}

class SheetReader {
  private readonly mergeOrigin = new Map<string, MergedRange>()
  private readonly covered = new Set<string>()

  constructor(private readonly sheet: ReadSheet) {
    for (const merge of sheet.merges) {
      this.mergeOrigin.set(`${merge.row}:${merge.column}`, merge)
      for (let r = merge.row; r <= merge.endRow; r += 1) {
        for (let c = merge.column; c <= merge.endColumn; c += 1) {
          if (r !== merge.row || c !== merge.column) this.covered.add(`${r}:${c}`)
        }
      }
    }
  }

  cell(row: number, column: number): ReadCell | undefined {
    return this.sheet.rows[row]?.[column]
  }

  text(row: number, column: number): string {
    return this.cell(row, column)?.text ?? ''
  }

  isCovered(row: number, column: number): boolean {
    return this.covered.has(`${row}:${column}`)
  }

  spanAt(row: number, column: number): { columns: number; rows: number } {
    const merge = this.mergeOrigin.get(`${row}:${column}`)
    if (!merge) return { columns: 1, rows: 1 }
    return {
      columns: merge.endColumn - merge.column + 1,
      rows: merge.endRow - merge.row + 1,
    }
  }

  get rowCount(): number {
    return this.sheet.rows.length
  }

  /** Last column with anything in it, so scans have somewhere to stop. */
  get columnCount(): number {
    return this.sheet.rows.reduce((widest, row) => Math.max(widest, row?.length ?? 0), 0)
  }

  rowIsEmpty(row: number): boolean {
    const cells = this.sheet.rows[row]
    if (!cells) return true
    return !cells.some((cell) => cell?.text)
  }
}

/**
 * Pulls one school's day out of a band: its own time column, then a cell per
 * group column, following merges in both directions.
 */
function readDayBlock(
  reader: SheetReader,
  timeColumn: number,
  groupColumns: number,
  firstRow: number,
  lastRow: number,
): { rows: { row: number; startMin: number; endMin: number | null }[]; sessions: RawSession[] } {
  const timeRows: number[] = []
  const rawTimes: (string | undefined)[] = []
  for (let row = firstRow; row <= lastRow; row += 1) {
    const text = reader.text(row, timeColumn)
    if (!text) continue
    timeRows.push(row)
    rawTimes.push(text)
  }

  const minutes = readDayTimes(rawTimes)
  const rows = timeRows
    .map((row, index) => ({
      row,
      startMin: minutes[index],
      endMin: endOfRange(rawTimes[index] ?? ''),
    }))
    .filter((entry): entry is { row: number; startMin: number; endMin: number | null } =>
      entry.startMin !== undefined,
    )

  /** The time the row after `row + span` starts, which ends a session. */
  const endAfter = (row: number, span: number): number => {
    const next = rows.find((entry) => entry.row >= row + span)
    if (next) return next.startMin
    const own = rows.find((entry) => entry.row === row)
    return (own?.startMin ?? 0) + TRAILING_DURATION
  }

  const sessions: RawSession[] = []
  for (const entry of rows) {
    for (let offset = 0; offset < groupColumns; offset += 1) {
      const column = timeColumn + 1 + offset
      if (reader.isCovered(entry.row, column)) continue

      const cell = reader.cell(entry.row, column)
      if (!cell?.text) continue

      const span = reader.spanAt(entry.row, column)
      const columnSpan = Math.min(span.columns, groupColumns - offset)
      const end = entry.endMin ?? endAfter(entry.row, span.rows)

      sessions.push({
        column: offset,
        columnSpan: Math.max(1, columnSpan),
        startMin: entry.startMin,
        endMin: Math.max(end, entry.startMin + 15),
        text: cell.text,
        fill: cell.fill,
      })
      offset += columnSpan - 1
    }
  }

  return { rows, sessions }
}

/**
 * The group columns a school actually occupies.
 *
 * Trailing blanks in the heading row usually mean the school has fewer groups —
 * but not always. These sheets are full of stays where a second group was added
 * to the days and never to the heading, and reading the heading alone silently
 * drops that column's whole itinerary, so the body has the final say on width.
 */
function readGroupNames(
  reader: SheetReader,
  row: number,
  from: number,
  to: number,
  body?: { firstRow: number; lastRow: number },
): string[] {
  const names: string[] = []
  for (let column = from; column <= to; column += 1) names.push(reader.text(row, column))
  while (names.length > 0 && !names[names.length - 1]) names.pop()

  if (body) {
    const used = contentWidth(reader, body.firstRow, body.lastRow, from, to)
    while (names.length < used) names.push('')
  }

  return names.map((name, index) => name || `Group ${index + 1}`)
}

/** How many columns from `from` carry a session, following merges rightwards. */
function contentWidth(
  reader: SheetReader,
  firstRow: number,
  lastRow: number,
  from: number,
  to: number,
): number {
  let width = 0
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = from; column <= to; column += 1) {
      if (reader.isCovered(row, column)) continue
      if (!reader.text(row, column)) continue
      const span = reader.spanAt(row, column).columns
      width = Math.max(width, Math.min(column + span, to + 1) - from)
    }
  }
  return width
}

// ─── the holistic layout ────────────────────────────────────────────────────

function parseHolisticSheet(sheet: ReadSheet): RawStay[] {
  const reader = new SheetReader(sheet)
  const width = reader.columnCount
  const stays = new Map<string, RawStay>()

  for (let row = 0; row < reader.rowCount; row += 1) {
    // A band header is a row of weekday names with dates directly underneath.
    const timeColumns: number[] = []
    for (let column = 0; column < width; column += 1) {
      if (weekdayOf(reader.text(row, column)) === undefined) continue
      const below = reader.cell(row + 1, column)
      if (below?.date || /^date$/i.test(below?.text ?? '')) timeColumns.push(column)
    }
    if (timeColumns.length === 0) continue

    const groupRow = row + 1
    let lastRow = groupRow + 1
    while (lastRow + 1 < reader.rowCount && !reader.rowIsEmpty(lastRow + 1)) lastRow += 1

    timeColumns.forEach((timeColumn, index) => {
      const blockEnd = (timeColumns[index + 1] ?? width) - 1
      const date = reader.cell(groupRow, timeColumn)?.date
      const weekday = weekdayOf(reader.text(row, timeColumn))
      if (!date || weekday === undefined) return

      const headline = reader.text(row, timeColumn + 1)
      if (!headline || /^school name/i.test(headline)) return

      const groups = readGroupNames(reader, groupRow, timeColumn + 1, blockEnd, {
        firstRow: groupRow + 1,
        lastRow,
      })
      if (groups.length === 0) return

      const { sessions } = readDayBlock(reader, timeColumn, groups.length, groupRow + 1, lastRow)
      if (sessions.length === 0) return

      const key = schoolKey(schoolNameOf(headline))
      const stay = stays.get(key) ?? { headline, days: [] }
      // Keep the fullest wording of the headline seen across the week.
      if (headline.length > stay.headline.length) stay.headline = headline
      stay.days.push({ date, weekday, groups, headline, sessions })
      stays.set(key, stay)
    })

    row = lastRow
  }

  return [...stays.values()]
}

// ─── the individual layout ──────────────────────────────────────────────────

function parseIndividualSheet(sheet: ReadSheet): RawStay | undefined {
  const reader = new SheetReader(sheet)
  const width = reader.columnCount

  // Day bands are "Mon | Group 1 | Group 2 …" with the times underneath.
  const bandRows: number[] = []
  for (let row = 0; row < reader.rowCount; row += 1) {
    if (weekdayOf(reader.text(row, 0)) === undefined) continue
    if (!isGroupHeading(reader.text(row, 1))) continue
    bandRows.push(row)
  }
  if (bandRows.length === 0) return undefined

  // Everything above the first band is the header block: name, dates, and
  // sometimes a location, in whichever column the sheet happens to use.
  const header: string[] = []
  for (let row = 0; row < bandRows[0]; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (reader.isCovered(row, column)) continue
      const text = reader.text(row, column)
      if (text) header.push(text)
    }
  }

  const meaningful = header.filter((text) => !/^(tl|sl)\s*=/i.test(text))
  const name = meaningful[0]
  if (!name) return undefined

  let statedDates: { start: string; end: string } | undefined
  const extras: string[] = []
  for (const text of meaningful.slice(1)) {
    const range = statedDates ? null : parseDateRange(text)
    if (range) statedDates = range
    else extras.push(text)
  }
  // Only the individual sheets carry a date in a real date cell.
  if (!statedDates) {
    for (let row = 0; row < bandRows[0]; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const date = reader.cell(row, column)?.date
        if (date) {
          statedDates = { start: date, end: date }
          break
        }
      }
      if (statedDates) break
    }
  }

  const days: RawDay[] = []
  bandRows.forEach((bandRow, index) => {
    const lastRow = (bandRows[index + 1] ?? reader.rowCount) - 1
    const weekday = weekdayOf(reader.text(bandRow, 0))
    if (weekday === undefined) return

    const groups = readGroupNames(reader, bandRow, 1, width - 1, {
      firstRow: bandRow + 1,
      lastRow,
    })
    if (groups.length === 0) return

    const { sessions } = readDayBlock(reader, 0, groups.length, bandRow + 1, lastRow)
    if (sessions.length === 0) return

    days.push({ weekday, groups, sessions })
  })

  if (days.length === 0) return undefined

  const headline = [name.replace(/\n/g, ' '), ...extras].join(' - ')
  return { headline, days, statedDates }
}

// ─── headline and dates ─────────────────────────────────────────────────────

const PACKAGE_ALIASES: { tier: PackageTier; match: RegExp }[] = [
  { tier: 'bronze', match: /^bronze/i },
  { tier: 'silver', match: /^silver/i },
  { tier: 'gold', match: /^gold/i },
  // "Ulitmate" is a standing typo in the source sheets.
  { tier: 'ultimate', match: /^(ultimate|ulitmate|ultmate)/i },
]

function schoolNameOf(headline: string): string {
  return headline.split('\n')[0].split(/\s[-–]\s/)[0].trim()
}

export interface HeadlineParts {
  schoolName: string
  yearLevel: string
  studentCount?: number
  packageTier: PackageTier
  building: string
  notes?: string
}

/**
 * Unpicks "Keithcot Farm Primary School - Year 5/6 - 90est / Ultimate - Rymill".
 *
 * The convention is loose — some stays have no package, some no year level,
 * some put the building on the first line — so each part is recognised by what
 * it looks like rather than by where it sits.
 */
export function parseHeadline(headline: string): HeadlineParts {
  const [first = '', ...rest] = headline.split('\n')
  const parts = first.split(/\s[-–]\s/).map((part) => part.trim()).filter(Boolean)

  const schoolName = (parts.shift() ?? 'Unknown school').replace(/\s+/g, ' ').trim()
  let yearLevel = ''
  let studentCount: number | undefined
  let building = ''
  const leftovers: string[] = []

  for (const part of parts) {
    // The count is often run onto the part before it — "Year 3-6- 54est" —
    // because the separator was typed without a leading space.
    let remainder = part
    const count = /^(.*?)[\s-]*(\d+)\s*est\.?$/i.exec(part)
    if (count) {
      studentCount = Number(count[2])
      remainder = count[1].trim()
    }
    if (!remainder) continue

    if (!yearLevel && /\b(year|yr|reception|foundation)\b/i.test(remainder)) {
      yearLevel = remainder
      continue
    }
    leftovers.push(remainder)
  }

  let packageTier: PackageTier = 'custom'
  for (const line of rest) {
    for (const segment of line.split(/\s[-–]\s/).map((part) => part.trim()).filter(Boolean)) {
      const alias = PACKAGE_ALIASES.find((entry) => entry.match.test(segment))
      if (alias && packageTier === 'custom') {
        packageTier = alias.tier
        continue
      }
      // The blank template leaves these words in place; they mean nothing.
      if (/^(package|building)$/i.test(segment)) continue
      if (!building) building = segment
      else leftovers.push(segment)
    }
  }

  // With no second line, a leftover on the first is the building.
  if (!building && leftovers.length > 0) building = leftovers.shift() ?? ''

  return {
    schoolName,
    yearLevel,
    studentCount,
    packageTier,
    building,
    notes: leftovers.length > 0 ? leftovers.join(' · ') : undefined,
  }
}

/** "12-14/10/2026", "15-16/10/26", "2/3/2026" and a bare "16/10/2026". */
export function parseDateRange(text: string): { start: string; end: string } | null {
  const cleaned = text.trim().replace(/\s+/g, '')

  const span = /^(\d{1,2})[-–](\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(cleaned)
  if (span) {
    const [, d1, d2, month, year] = span
    const start = isoDate(Number(d1), Number(month), Number(year))
    const end = isoDate(Number(d2), Number(month), Number(year))
    return start && end ? { start, end } : null
  }

  const crossMonth =
    /^(\d{1,2})[/.](\d{1,2})[-–](\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(cleaned)
  if (crossMonth) {
    const [, d1, m1, d2, m2, year] = crossMonth
    const start = isoDate(Number(d1), Number(m1), Number(year))
    const end = isoDate(Number(d2), Number(m2), Number(year))
    return start && end ? { start, end } : null
  }

  const single = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(cleaned)
  if (single) {
    const iso = isoDate(Number(single[1]), Number(single[2]), Number(single[3]))
    return iso ? { start: iso, end: iso } : null
  }

  return null
}

function isoDate(day: number, month: number, year: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  const fullYear = year < 100 ? 2000 + year : year
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Puts an individual sheet's days on real dates.
 *
 * Those sheets name their weekdays but only state the stay's dates once, in the
 * header, so the days are laid onto that range by weekday.
 */
function datesForStay(stay: RawStay): (string | undefined)[] {
  if (stay.days.every((day) => day.date)) return stay.days.map((day) => day.date)
  if (!stay.statedDates) return stay.days.map(() => undefined)

  const { start, end } = stay.statedDates
  const span = Math.max(daysBetween(start, end), 0)
  // A range that can't hold the days listed is trusted for its start only.
  const candidates = dateRange(start, addDays(start, Math.max(span, stay.days.length - 1)))

  return stay.days.map((day, index) => {
    const match = candidates.find(
      (date, position) => position >= index && new Date(`${date}T00:00:00`).getDay() === day.weekday,
    )
    return match ?? candidates[index]
  })
}

// ─── assembling the result ──────────────────────────────────────────────────

interface Candidate {
  key: string
  stay: RawStay
  dates: (string | undefined)[]
  source: string
  /** Individual handouts are the more carefully kept copy of a stay. */
  preferred: boolean
}

export function parseWorkbooks(
  files: { name: string; sheets: ReadSheet[] }[],
  catalogue: Activity[],
  options: ImportOptions,
): ImportResult {
  const siteCatalogue = catalogue.filter((activity) => activity.sites.includes(options.site))
  const warnings: string[] = []
  const summary: ImportResult['files'] = []
  const candidates: Candidate[] = []

  for (const file of files) {
    let layout: 'holistic' | 'individual' | 'none' = 'none'
    let schools = 0

    for (const sheet of file.sheets) {
      if (/colour key/i.test(sheet.name)) continue

      const holistic = parseHolisticSheet(sheet)
      if (holistic.length > 0) {
        layout = 'holistic'
        schools += holistic.length
        for (const stay of holistic) {
          candidates.push({
            key: schoolKey(schoolNameOf(stay.headline)),
            stay,
            dates: datesForStay(stay),
            source: file.name,
            preferred: false,
          })
        }
        continue
      }

      const individual = parseIndividualSheet(sheet)
      if (individual) {
        layout = layout === 'holistic' ? layout : 'individual'
        schools += 1
        const dates = datesForStay(individual)
        if (dates.some((date) => !date)) {
          warnings.push(
            `${file.name}: couldn't read the dates from the header, so its days were skipped.`,
          )
          continue
        }
        candidates.push({
          key: schoolKey(schoolNameOf(individual.headline)),
          stay: individual,
          dates,
          source: file.name,
          preferred: true,
        })
      }
    }

    summary.push({ name: file.name, layout, schools })
    if (layout === 'none') {
      warnings.push(`${file.name}: no itinerary found in it.`)
    }
  }

  return assemble(candidates, siteCatalogue, options, summary, warnings)
}

function assemble(
  candidates: Candidate[],
  catalogue: Activity[],
  options: ImportOptions,
  files: ImportResult['files'],
  warnings: string[],
): ImportResult {
  // One stay is usually described twice — once on the week's holistic sheet and
  // once on the school's own handout — so the two are merged. A school can be
  // back later in the term, though, so the dates have to agree as well as the
  // name: same school, overlapping or adjacent days, one booking.
  const clusters: { key: string; from: string; to: string; members: Candidate[] }[] = []
  for (const candidate of candidates) {
    const dates = (candidate.dates.filter(Boolean) as string[]).sort()
    if (dates.length === 0) continue
    const from = dates[0]
    const to = dates[dates.length - 1]

    const existing = clusters.find(
      (cluster) =>
        sameSchool(cluster.key, candidate.key) &&
        from <= addDays(cluster.to, 1) &&
        to >= addDays(cluster.from, -1),
    )
    if (existing) {
      existing.members.push(candidate)
      if (from < existing.from) existing.from = from
      if (to > existing.to) existing.to = to
      // Keep the fuller spelling of the name as the cluster's key.
      if (candidate.key.length > existing.key.length) existing.key = candidate.key
    } else {
      clusters.push({ key: candidate.key, from, to, members: [candidate] })
    }
  }

  const groups = new Map(clusters.map((cluster, index) => [String(index), cluster.members]))

  const newActivities = new Map<string, Activity>()
  const bookings: ImportedBooking[] = []

  for (const group of groups.values()) {
    // The holistic sheet carries the year level, package and building; the
    // school's own handout carries the better-maintained day detail.
    const withMeta = [...group].sort((a, b) => b.stay.headline.length - a.stay.headline.length)[0]
    const parts = parseHeadline(withMeta.stay.headline)

    // The week's sheet abbreviates where the school's own handout spells the
    // name out, and the spelled-out one is the one to keep.
    for (const candidate of group) {
      const name = parseHeadline(candidate.stay.headline).schoolName
      if (name.length > parts.schoolName.length) parts.schoolName = name
    }

    const dayCount = Math.max(...group.map((candidate) => candidate.stay.days.length))
    const groupCount = Math.max(
      ...group.flatMap((candidate) => candidate.stay.days.map((day) => day.groups.length)),
    )
    const groupNames =
      group
        .flatMap((candidate) => candidate.stay.days)
        .find((day) => day.groups.length === groupCount)?.groups ??
      Array.from({ length: groupCount }, (_, index) => `Group ${index + 1}`)

    const bookingId = uid('bkg')
    const groupRecords: Group[] = groupNames.map((name) => ({ id: uid('grp'), name }))

    // One winning source per date: the handout where there is one.
    const byDate = new Map<string, { day: RawDay; preferred: boolean }>()
    for (const candidate of group) {
      candidate.stay.days.forEach((day, index) => {
        const date = candidate.dates[index]
        if (!date) return
        const existing = byDate.get(date)
        if (!existing || (candidate.preferred && !existing.preferred)) {
          byDate.set(date, { day, preferred: candidate.preferred })
        }
      })
    }

    const dates = [...byDate.keys()].sort()
    if (dates.length === 0) continue

    const blocks: Block[] = []
    for (const date of dates) {
      const day = byDate.get(date)!.day
      for (const session of day.sessions) {
        const classified = classifyCell(session.text, session.fill, catalogue)

        let activityId = classified.activityId
        let title = classified.title
        let colour = classified.kind === 'activity' ? undefined : classified.colour

        if (classified.newActivity) {
          if (options.addUnknownActivities) {
            const key = normalise(classified.newActivity.name)
            let activity = newActivities.get(key)
            if (!activity) {
              activity = {
                id: uid('act'),
                name: classified.newActivity.name,
                sites: [options.site],
                colour: classified.newActivity.colour,
                defaultDurationMin: Math.max(session.endMin - session.startMin, 30),
                venueIds: [],
                deliveries: [classified.delivery],
              }
              newActivities.set(key, activity)
            }
            activityId = activity.id
            // The activity supplies the name; the cell's own wording is only
            // worth keeping when it said something more.
            title = classified.title === activity.name ? undefined : classified.title
          } else {
            // Not joining the catalogue, so the block has to carry its own
            // name and colour or it would read as untitled.
            title = classified.title ?? classified.newActivity.name
            colour = classified.newActivity.colour
          }
        }

        const covered = groupRecords
          .slice(session.column, session.column + session.columnSpan)
          .map((record) => record.id)
        if (covered.length === 0) continue

        blocks.push({
          id: uid('blk'),
          bookingId,
          date,
          startMin: session.startMin,
          endMin: session.endMin,
          groupIds: covered,
          kind: classified.kind,
          activityId,
          title,
          delivery: classified.delivery,
          colour,
        })
      }
    }

    if (dayCount > dates.length) {
      warnings.push(
        `${parts.schoolName}: ${dayCount} days in the sheet but only ${dates.length} could be dated.`,
      )
    }

    bookings.push({
      booking: {
        id: bookingId,
        site: options.site,
        schoolName: parts.schoolName,
        yearLevel: parts.yearLevel,
        studentCount: parts.studentCount,
        packageTier: parts.packageTier,
        building: parts.building,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        groups: groupRecords,
        notes: parts.notes,
      },
      blocks,
      sources: [...new Set(group.map((candidate) => candidate.source))],
    })
  }

  bookings.sort(
    (a, b) =>
      a.booking.startDate.localeCompare(b.booking.startDate) ||
      a.booking.schoolName.localeCompare(b.booking.schoolName),
  )

  return {
    bookings,
    newActivities: [...newActivities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files,
    warnings,
  }
}
