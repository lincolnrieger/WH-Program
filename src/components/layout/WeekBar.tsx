import { useMemo, useState } from 'react'
import type { Booking } from '@/types'
import {
  addDays, dateRange, formatDate, startOfWeek, toISODate, weekdayShort,
} from '@/lib/time'
import { Button, IconButton, Input, cx } from '@/components/ui/primitives'

/**
 * Week and day selector shared by the planning views.
 *
 * A program can hold as many weeks as you like — this is how you move between
 * them. Each day shows how many schools are on site, so a glance is enough to
 * find the week you meant.
 */
export function WeekBar({
  bookings,
  date,
  onDateChange,
  errorDates,
}: {
  bookings: Booking[]
  date: string
  onDateChange: (date: string) => void
  /** Dates with at least one clash, badged on the day button. */
  errorDates: Set<string>
}) {
  const [picking, setPicking] = useState(false)

  const weekStart = useMemo(() => startOfWeek(date), [date])
  const days = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart])

  const occupancy = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of days) {
      map.set(
        day,
        bookings.filter((b) => day >= b.startDate && day <= b.endDate).length,
      )
    }
    return map
  }, [days, bookings])

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`
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
            className="rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-[var(--ink)] transition-colors hover:bg-[var(--surface-sunk)]"
            aria-expanded={picking}
          >
            {weekLabel}
            <span aria-hidden className="ml-1 text-[9px] opacity-50">
              &#9662;
            </span>
          </button>
          {picking && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPicking(false)} aria-hidden />
              <div className="absolute left-0 z-50 mt-1 w-60 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-lg)]">
                <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
                  Jump to a date
                </span>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    if (!event.target.value) return
                    onDateChange(event.target.value)
                    setPicking(false)
                  }}
                />
                <div className="mt-2 flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      onDateChange(today)
                      setPicking(false)
                    }}
                  >
                    This week
                  </Button>
                  <NextBookingButton
                    bookings={bookings}
                    from={date}
                    onPick={(next) => {
                      onDateChange(next)
                      setPicking(false)
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <IconButton label="Next week" onClick={() => onDateChange(addDays(date, 7))}>
          &#8250;
        </IconButton>
      </div>

      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const count = occupancy.get(day) ?? 0
          const active = day === date
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDateChange(day)}
              aria-current={active ? 'date' : undefined}
              className={cx(
                'relative min-w-[60px] rounded-md border px-2 py-1 text-left transition-colors',
                active
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
                  : count === 0
                    ? 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-faint)] hover:bg-[var(--surface-sunk)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-sunk)]',
              )}
            >
              <span className="flex items-baseline gap-1">
                <span className="text-[12px] font-semibold">{weekdayShort(day)}</span>
                <span className={cx('tnum text-[10px]', active ? 'opacity-75' : 'text-[var(--ink-faint)]')}>
                  {Number(day.slice(8))}
                </span>
                {day === today && (
                  <span
                    aria-label="Today"
                    className={cx(
                      'ml-auto h-1.5 w-1.5 rounded-full',
                      active ? 'bg-[var(--brand-ink)]' : 'bg-[var(--brand)]',
                    )}
                  />
                )}
              </span>
              <span
                className={cx(
                  'tnum block text-[10px]',
                  active ? 'opacity-80' : 'text-[var(--ink-faint)]',
                )}
              >
                {count === 0 ? 'free' : `${count} school${count === 1 ? '' : 's'}`}
              </span>
              {errorDates.has(day) && (
                <span
                  aria-label="Has clashes"
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Jumps to the next week that actually has a school booked in. */
function NextBookingButton({
  bookings,
  from,
  onPick,
}: {
  bookings: Booking[]
  from: string
  onPick: (date: string) => void
}) {
  const next = useMemo(() => {
    const upcoming = bookings
      .filter((b) => b.startDate > from)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return upcoming[0]
  }, [bookings, from])

  if (!next) return null
  return (
    <Button size="sm" onClick={() => onPick(next.startDate)}>
      Next booking · {formatDate(next.startDate)}
    </Button>
  )
}
