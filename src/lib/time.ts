/**
 * Time helpers. Times of day are minutes from midnight; dates are ISO
 * `YYYY-MM-DD` strings treated as local calendar days.
 */

export const MINUTES_IN_DAY = 24 * 60

/** Formats 570 as "9:30am" — the house style used across the existing sheets. */
export function formatTime(min: number): string {
  const wrapped = ((min % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h24 = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const suffix = h24 < 12 ? 'am' : 'pm'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

/** Always includes minutes: "9:00am". Used on axis labels where alignment matters. */
export function formatTimeFull(min: number): string {
  const wrapped = ((min % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h24 = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const suffix = h24 < 12 ? 'am' : 'pm'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

export function formatRange(startMin: number, endMin: number): string {
  return `${formatTime(startMin)} – ${formatTime(endMin)}`
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}hr`
  return `${h}hr ${m}min`
}

/**
 * Parses the loose time formats staff actually type: "9", "930", "9:30",
 * "9.30am", "1.30pm", "13:30". Returns null when it can't make sense of it.
 */
export function parseTime(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null

  const match = text.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm|a|p)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]?.[0]

  if (minutes > 59) return null

  // Bare 3-4 digit forms like "930" or "1330".
  if (!match[2] && match[1].length > 2) {
    const digits = match[1]
    hours = Number(digits.slice(0, digits.length - 2))
    const mm = Number(digits.slice(-2))
    if (mm > 59 || hours > 23) return null
    return hours * 60 + mm
  }

  if (meridiem === 'p' && hours < 12) hours += 12
  if (meridiem === 'a' && hours === 12) hours = 0
  if (!meridiem && hours <= 7) hours += 12 // "1.30" on a camp day means the afternoon
  if (hours > 23) return null

  return hours * 60 + minutes
}

export function snap(min: number, increment: number): number {
  if (increment <= 1) return Math.round(min)
  return Math.round(min / increment) * increment
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

// ─── Dates ──────────────────────────────────────────────────────────────────

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses `YYYY-MM-DD` as a *local* date, avoiding the UTC-shift trap. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = fromISODate(startIso).getTime()
  const end = fromISODate(endIso).getTime()
  return Math.round((end - start) / 86_400_000)
}

/** Inclusive list of ISO dates from start to end. */
export function dateRange(startIso: string, endIso: string): string[] {
  const span = daysBetween(startIso, endIso)
  if (span < 0) return [startIso]
  return Array.from({ length: span + 1 }, (_, i) => addDays(startIso, i))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayShort(iso: string): string {
  return WEEKDAYS[fromISODate(iso).getDay()]
}

/** "Mon 21 Sep" */
export function formatDate(iso: string): string {
  const date = fromISODate(iso)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "Monday 21 September" — how a date reads on a handout. */
export function formatDateLong(iso: string): string {
  const date = fromISODate(iso)
  return `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`
}

/**
 * "Monday 21 – Wednesday 23 September 2026", dropping whatever the two ends
 * share so the line stays short.
 */
export function formatDateRangeLong(startIso: string, endIso: string): string {
  const start = fromISODate(startIso)
  const end = fromISODate(endIso)
  const year = end.getFullYear()

  if (startIso === endIso) return `${formatDateLong(startIso)} ${year}`

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === year
  const from = sameMonth
    ? `${WEEKDAYS_LONG[start.getDay()]} ${start.getDate()}`
    : `${WEEKDAYS_LONG[start.getDay()]} ${start.getDate()} ${MONTHS_LONG[start.getMonth()]}`
  return `${from} – ${formatDateLong(endIso)} ${year}`
}

/**
 * "02-04/03/26" — the shorthand the printed itineraries head a stay with.
 *
 * A stay inside one month collapses to two day numbers; one that crosses a
 * month keeps both, and a single day is just itself.
 */
export function formatStayRange(startIso: string, endIso: string): string {
  const start = fromISODate(startIso)
  const end = fromISODate(endIso)
  const dd = (date: Date) => String(date.getDate()).padStart(2, '0')
  const mm = (date: Date) => String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(end.getFullYear()).slice(-2)

  if (startIso === endIso) return `${dd(end)}/${mm(end)}/${yy}`
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${dd(start)}-${dd(end)}/${mm(end)}/${yy}`
  }
  return `${dd(start)}/${mm(start)}-${dd(end)}/${mm(end)}/${yy}`
}

/** "2-Mar" — the date as it sits under the weekday on the holistic sheet. */
export function formatDayShort(iso: string): string {
  const date = fromISODate(iso)
  return `${date.getDate()}-${MONTHS[date.getMonth()]}`
}

/** "21/09/2026" — Australian order, for print headers. */
export function formatDateNumeric(iso: string): string {
  const date = fromISODate(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const date = fromISODate(iso)
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return addDays(iso, delta)
}
