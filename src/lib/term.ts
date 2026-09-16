/**
 * South Australian school terms.
 *
 * Camps are booked and talked about in term weeks — "Term 3 Week 4" is how a
 * school names its visit long before anyone looks up the date. Every date label
 * in the app can therefore carry the term and week alongside the calendar date.
 *
 * Published SA term dates are listed year by year below. Years outside the
 * table fall back to the pattern the department has used for decades (terms
 * start on a Monday near the same date each year and run 11/10/10/9 weeks), so
 * the app keeps labelling sensibly rather than going blank — see
 * `TermWeek.exact` for which of the two a label came from.
 */

import { addDays, daysBetween, fromISODate, startOfWeek, toISODate } from './time'

export interface TermDates {
  /** First day of term, ISO. */
  start: string
  /** Last day of term, ISO. */
  end: string
}

/**
 * Published South Australian government school term dates.
 *
 * Add a year here when the department publishes it — everything downstream
 * picks it up. `DATA.md` explains where the dates come from.
 */
export const SA_TERM_DATES: Record<number, TermDates[]> = {
  2024: [
    { start: '2024-01-29', end: '2024-04-12' },
    { start: '2024-04-29', end: '2024-07-05' },
    { start: '2024-07-22', end: '2024-09-27' },
    { start: '2024-10-14', end: '2024-12-13' },
  ],
  2025: [
    { start: '2025-01-28', end: '2025-04-11' },
    { start: '2025-04-28', end: '2025-07-04' },
    { start: '2025-07-21', end: '2025-09-26' },
    { start: '2025-10-13', end: '2025-12-12' },
  ],
  2026: [
    { start: '2026-01-27', end: '2026-04-10' },
    { start: '2026-04-27', end: '2026-07-03' },
    { start: '2026-07-20', end: '2026-09-25' },
    { start: '2026-10-12', end: '2026-12-11' },
  ],
}

/** Roughly where each term starts, and how many weeks it runs, for unknown years. */
const FALLBACK_PATTERN = [
  { month: 1, day: 28, weeks: 11 },
  { month: 4, day: 28, weeks: 10 },
  { month: 7, day: 21, weeks: 10 },
  { month: 10, day: 13, weeks: 9 },
]

/** The Monday on or after `iso`. */
function mondayOnOrAfter(iso: string): string {
  const day = fromISODate(iso).getDay()
  if (day === 1) return iso
  return addDays(iso, day === 0 ? 1 : 8 - day)
}

function inferTerms(year: number): TermDates[] {
  return FALLBACK_PATTERN.map(({ month, day, weeks }) => {
    const start = mondayOnOrAfter(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    )
    // Terms finish on the Friday of their last week.
    return { start, end: addDays(start, weeks * 7 - 3) }
  })
}

const inferred = new Map<number, TermDates[]>()

export function termsForYear(year: number): { terms: TermDates[]; exact: boolean } {
  const published = SA_TERM_DATES[year]
  if (published) return { terms: published, exact: true }

  let guess = inferred.get(year)
  if (!guess) {
    guess = inferTerms(year)
    inferred.set(year, guess)
  }
  return { terms: guess, exact: false }
}

export interface TermWeek {
  /** 1–4, or null when the date falls in the holidays. */
  term: number | null
  /** Week within the term, 1-based. Null in the holidays. */
  week: number | null
  /** "Term 3 Week 4", or "School holidays". */
  label: string
  /** "T3 W4", for tight spots like the week bar. */
  shortLabel: string
  /** False when the year's dates were inferred rather than published. */
  exact: boolean
}

const HOLIDAYS: Omit<TermWeek, 'exact'> = {
  term: null,
  week: null,
  label: 'School holidays',
  shortLabel: 'Holidays',
}

/**
 * The term and week a date falls in.
 *
 * Week 1 is the week containing the first day of term, so a Wednesday start
 * still makes that whole week "Week 1" — which is how schools count it.
 */
export function termWeekOf(iso: string): TermWeek {
  const year = fromISODate(iso).getFullYear()
  const { terms, exact } = termsForYear(year)

  for (let index = 0; index < terms.length; index += 1) {
    const { start, end } = terms[index]
    if (iso < start || iso > end) continue
    const week = Math.floor(daysBetween(startOfWeek(start), iso) / 7) + 1
    return {
      term: index + 1,
      week,
      label: `Term ${index + 1} Week ${week}`,
      shortLabel: `T${index + 1} W${week}`,
      exact,
    }
  }

  return { ...HOLIDAYS, exact }
}

/**
 * Label for a whole week, taken from its Monday.
 *
 * A week that straddles the end of term is still named by its Monday, except
 * where the Monday is in the holidays and the term starts mid-week — then the
 * term's own first day wins, so a Tuesday start still reads "Term 1 Week 1".
 */
export function termWeekOfWeek(iso: string): TermWeek {
  const monday = startOfWeek(iso)
  const fromMonday = termWeekOf(monday)
  if (fromMonday.term !== null) return fromMonday

  for (let offset = 1; offset <= 4; offset += 1) {
    const found = termWeekOf(addDays(monday, offset))
    if (found.term !== null) return found
  }
  return fromMonday
}

/** "Term 3 Week 4" for a week, or a plain range when it's the holidays. */
export function weekHeading(iso: string): string {
  return termWeekOfWeek(iso).label
}

/** The Monday of the current week, for "jump to today". */
export function thisWeek(): string {
  return startOfWeek(toISODate(new Date()))
}
