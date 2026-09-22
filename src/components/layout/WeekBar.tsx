import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booking } from '@/types'
import {
  addDays, dateRange, formatDate, startOfWeek, toISODate, weekdayShort,
} from '@/lib/time'
import { termWeekOf, termWeekOfWeek } from '@/lib/term'
import { Button, IconButton, Input, cx } from '@/components/ui/primitives'

/** How many weeks either side of the current one the picker lists. */
const PICKER_BACK = 6
const PICKER_FORWARD = 20

/**
 * Week and day selector shared by the planning views.
 *
 * Camps are named by term week long before anyone looks up a date — "Term 3
 * Week 4" is the handle staff and schools both use — so that is what the bar
 * leads with, with the calendar dates underneath. The picker lists whole weeks
 * the same way, so jumping to the week you mean is one click rather than a
 * date-field guess.
 *
 * The day strip is a multi-select: click a day for that day, drag across the
 * strip for a run of them, ctrl-click to add or drop one. Everything below
 * shows whatever is selected here, side by side, so "Tuesday and Wednesday" or
 * a whole week is a selection rather than a mode.
 */
export function WeekBar({
  bookings,
  date,
  selected,
  stay,
  onDateChange,
  onDatesChange,
}: {
  bookings: Booking[]
  /** The day the day-scoped tools act on. */
  date: string
  /** Every day currently on screen, including the active one. */
  selected: string[]
  /** The open school's own days, offered as a one-click selection. */
  stay?: { label: string; dates: string[] }
  onDateChange: (date: string) => void
  onDatesChange: (dates: string[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const anchorRef = useRef<string | null>(null)

  const weekStart = useMemo(() => startOfWeek(date), [date])
  const weekDays = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  // A stay can straddle a Sunday, so a selected day outside this week still
  // gets a chip — every day on screen is visible in the strip, or turning one
  // off means hunting for it.
  const days = useMemo(
    () => [...new Set([...weekDays, ...selected])].sort(),
    [weekDays, selected],
  )

  const chosen = useMemo(() => new Set(selected), [selected])

  // Dragging across the strip selects a run, the way dragging across a
  // calendar does. Releasing anywhere ends it, including off the strip.
  useEffect(() => {
    const stop = () => {
      anchorRef.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  function runBetween(a: string, b: string): string[] {
    const [from, to] = a <= b ? [a, b] : [b, a]
    return days.filter((day) => day >= from && day <= to)
  }

  const occupancy = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of days) {
      map.set(day, bookings.filter((b) => day >= b.startDate && day <= b.endDate).length)
    }
    return map
  }, [days, bookings])

  const term = termWeekOfWeek(weekStart)
  const today = toISODate(new Date())

  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
      <div className="flex items-center gap-0.5">
        <IconButton label="Previous week" onClick={() => onDateChange(addDays(date, -7))}>
          &#8249;
        </IconButton>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="rounded-md px-2 py-0.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
            aria-expanded={picking}
          >
            <span className="flex items-center gap-1 text-[12.5px] leading-tight font-semibold whitespace-nowrap text-[var(--ink)]">
              {term.label}
              {!term.exact && (
                <span
                  title="Term dates for this year aren’t published in the app yet — this is the usual pattern."
                  className="text-[10px] text-[var(--ink-faint)]"
                >
                  ~
                </span>
              )}
              <span aria-hidden className="text-[9px] opacity-50">
                &#9662;
              </span>
            </span>
            <span className="tnum block text-[10.5px] leading-tight whitespace-nowrap text-[var(--ink-faint)]">
              {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
            </span>
          </button>

          {picking && (
            <WeekPicker
              date={date}
              bookings={bookings}
              onPick={(next) => {
                onDateChange(next)
                setPicking(false)
              }}
              onClose={() => setPicking(false)}
            />
          )}
        </div>

        <IconButton label="Next week" onClick={() => onDateChange(addDays(date, 7))}>
          &#8250;
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Days shown">
        {days.map((day) => {
          const count = occupancy.get(day) ?? 0
          const on = chosen.has(day)
          const anchor = day === date
          const outsideWeek = day < weekDays[0] || day > weekDays[6]
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              aria-current={anchor ? 'date' : undefined}
              title={
                `${formatDate(day)} · ${termWeekOf(day).label}` +
                '\nClick for this day · drag across for a run · ctrl-click to add or drop one'
              }
              onPointerDown={(event) => {
                if (event.button !== 0) return
                anchorRef.current = day
                if (event.ctrlKey || event.metaKey) {
                  // Ctrl-click drops a day unless it is the last one standing.
                  const next = on ? selected.filter((d) => d !== day) : [...selected, day]
                  if (next.length > 0) onDatesChange(next)
                  return
                }
                onDateChange(day)
              }}
              onPointerEnter={() => {
                const from = anchorRef.current
                if (from && from !== day) onDatesChange(runBetween(from, day))
              }}
              className={cx(
                'relative min-w-[62px] rounded-md border px-2 py-1 text-left transition-colors select-none',
                outsideWeek && 'border-dashed',
                on
                  ? anchor
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
                    : 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--ink)]'
                  : count === 0
                    ? 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-faint)] hover:bg-[var(--surface-sunk)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-sunk)]',
              )}
            >
              <span className="flex items-baseline gap-1">
                <span className="text-[12px] font-semibold">{weekdayShort(day)}</span>
                <span className={cx('tnum text-[10px]', anchor ? 'opacity-75' : 'text-[var(--ink-faint)]')}>
                  {Number(day.slice(8))}
                </span>
                {day === today && (
                  <span
                    aria-label="Today"
                    className={cx(
                      'ml-auto h-1.5 w-1.5 rounded-full',
                      anchor ? 'bg-[var(--brand-ink)]' : 'bg-[var(--brand)]',
                    )}
                  />
                )}
              </span>
              <span
                className={cx(
                  'tnum block text-[10px]',
                  anchor ? 'opacity-80' : 'text-[var(--ink-faint)]',
                )}
              >
                {count === 0 ? 'free' : `${count} school${count === 1 ? '' : 's'}`}
              </span>
            </button>
          )
        })}

        <span aria-hidden className="mx-0.5 h-7 w-px bg-[var(--line)]" />

        <Chip
          label="Week"
          title="Show all seven days side by side"
          on={weekDays.every((day) => chosen.has(day)) && selected.length === weekDays.length}
          onClick={() => onDatesChange(weekDays)}
        />
        {stay && stay.dates.length > 1 && (
          <Chip
            label={stay.label}
            title="Show every day of this school's visit"
            on={
              stay.dates.length === selected.length &&
              stay.dates.every((day) => chosen.has(day))
            }
            onClick={() => onDatesChange(stay.dates)}
          />
        )}
        {selected.length > 1 && (
          <Chip
            label="Just one"
            title="Back to a single day"
            on={false}
            onClick={() => onDateChange(date)}
          />
        )}
      </div>
    </div>
  )
}

/** A small on/off button for the ready-made day selections. */
function Chip({
  label, title, on, onClick,
}: {
  label: string
  title: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cx(
        'h-[38px] rounded-md border px-2.5 text-[11.5px] font-medium transition-colors',
        on
          ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
      )}
    >
      {label}
    </button>
  )
}

/**
 * Week list with term labels and who's on site.
 *
 * Picking a week is the common move; picking an exact date is the exception, so
 * the list leads and the date field sits underneath it.
 */
function WeekPicker({
  date,
  bookings,
  onPick,
  onClose,
}: {
  date: string
  bookings: Booking[]
  onPick: (date: string) => void
  onClose: () => void
}) {
  const current = startOfWeek(date)
  const today = toISODate(new Date())
  const currentRef = useRef<HTMLButtonElement>(null)

  // Open onto the week you're already on, not the top of the list.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const weeks = useMemo(() => {
    const first = addDays(current, -PICKER_BACK * 7)
    return Array.from({ length: PICKER_BACK + PICKER_FORWARD + 1 }, (_, index) => {
      const start = addDays(first, index * 7)
      const end = addDays(start, 6)
      const schools = bookings.filter((b) => b.startDate <= end && b.endDate >= start)
      return { start, end, schools, term: termWeekOfWeek(start) }
    })
  }, [current, bookings])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute left-0 z-50 mt-1 w-[320px] rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="max-h-[320px] overflow-y-auto p-1">
          {weeks.map(({ start, end, schools, term }) => {
            const isCurrent = start === current
            const hasToday = today >= start && today <= end
            return (
              <button
                key={start}
                ref={isCurrent ? currentRef : undefined}
                type="button"
                onClick={() => onPick(start)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  isCurrent
                    ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                    : 'hover:bg-[var(--surface-sunk)]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'block truncate text-[12.5px] font-semibold',
                      isCurrent ? 'text-[var(--brand)]' : 'text-[var(--ink)]',
                    )}
                  >
                    {term.label}
                    {hasToday && (
                      <span className="ml-1.5 rounded-full bg-[var(--brand)] px-1.5 py-px text-[9.5px] font-semibold text-[var(--brand-ink)]">
                        now
                      </span>
                    )}
                  </span>
                  <span className="tnum block truncate text-[10.5px] text-[var(--ink-faint)]">
                    {formatDate(start)} – {formatDate(end)}
                  </span>
                </span>

                {/* One dot per school, so a busy week is obvious at a glance. */}
                <span className="flex shrink-0 items-center gap-1">
                  <span className="flex gap-[2px]">
                    {schools.slice(0, 5).map((school) => (
                      <span
                        key={school.id}
                        title={school.schoolName}
                        className="h-1.5 w-1.5 rounded-full bg-[var(--brand-soft)]"
                      />
                    ))}
                  </span>
                  <span className="tnum w-3 text-right text-[10.5px] text-[var(--ink-faint)]">
                    {schools.length || ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 border-t border-[var(--line)] p-2">
          <Button size="sm" onClick={() => onPick(today)}>
            This week
          </Button>
          <Input
            type="date"
            value={date}
            aria-label="Jump to a date"
            className="tnum h-7 min-w-0 flex-1 text-[12px]"
            onChange={(event) => {
              if (event.target.value) onPick(event.target.value)
            }}
          />
        </div>
      </div>
    </>
  )
}
