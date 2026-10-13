import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booking } from '@/types'
import { addDays, formatDate, startOfWeek, weekdayShort } from '@/lib/time'
import { termWeekOf } from '@/lib/term'
import { Button, Input, cx } from '@/components/ui/primitives'

/**
 * Which school you're planning, as a row of tabs.
 *
 * Every other control on the page acts on the open school, so the choice sits
 * in plain sight above the grid rather than behind a sidebar tab. The tabs are
 * the schools on site in the week you're looking at — the handful you're
 * actually juggling — and "Find a school" reaches any other week.
 */
export function SchoolBar({
  bookings,
  date,
  activeBookingId,
  onOpen,
  onAdd,
}: {
  /** Every booking at this site. */
  bookings: Booking[]
  date: string
  activeBookingId: string | null
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  const [finding, setFinding] = useState(false)

  const thisWeek = useMemo(() => {
    const start = startOfWeek(date)
    const end = addDays(start, 6)
    return bookings
      .filter((b) => b.startDate <= end && b.endDate >= start)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.schoolName.localeCompare(b.schoolName))
  }, [bookings, date])

  return (
    <div className="no-print flex shrink-0 items-stretch gap-2 border-b border-[var(--line)] bg-[var(--surface-sunk)] pr-3 pl-2">
      <div role="list" aria-label="Schools this week" className="flex min-w-0 items-end gap-1 overflow-x-auto pt-1.5">
        {thisWeek.map((booking) => {
          const active = booking.id === activeBookingId
          return (
            <button
              key={booking.id}
              role="listitem"
              type="button"
              onClick={() => onOpen(booking.id)}
              aria-current={active ? 'true' : undefined}
              title={booking.schoolName}
              className={cx(
                'relative -mb-px max-w-[230px] min-w-[120px] shrink-0 rounded-t-md border border-b-0 px-3 pt-1.5 pb-2 text-left transition-colors',
                active
                  ? 'border-[var(--line)] bg-[var(--surface)]'
                  : 'border-transparent hover:bg-[var(--surface)]/60',
              )}
            >
              {active && (
                <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-[var(--brand)]" />
              )}
              <span
                className={cx(
                  'block truncate text-[12.5px] leading-tight font-semibold',
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]',
                )}
              >
                {booking.schoolName || 'Unnamed school'}
              </span>
              <span className="tnum block truncate text-[11px] leading-tight text-[var(--ink-faint)]">
                {stayLabel(booking)}
              </span>
            </button>
          )
        })}

        {thisWeek.length === 0 && (
          <p className="self-center px-1 pb-1.5 text-[12px] text-[var(--ink-faint)]">
            No schools on site this week.
          </p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 py-1.5">
        <div className="relative">
          <Button size="sm" variant="ghost" onClick={() => setFinding((v) => !v)} aria-expanded={finding}>
            Find a school
          </Button>
          {finding && (
            <FindSchool
              bookings={bookings}
              onPick={(id) => {
                onOpen(id)
                setFinding(false)
              }}
              onClose={() => setFinding(false)}
            />
          )}
        </div>
        <Button size="sm" onClick={onAdd}>
          + Add school
        </Button>
      </div>
    </div>
  )
}

/** "Mon 12 – Wed 14", or just "Mon 12" for a day visit. */
function stayLabel(booking: Booking): string {
  const first = `${weekdayShort(booking.startDate)} ${Number(booking.startDate.slice(8))}`
  if (booking.startDate === booking.endDate) return first
  return `${first} – ${weekdayShort(booking.endDate)} ${Number(booking.endDate.slice(8))}`
}

/** Search across every week, for the school you know by name but not by date. */
function FindSchool({
  bookings,
  onPick,
  onClose,
}: {
  bookings: Booking[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    const found = text
      ? bookings.filter((b) =>
          [b.schoolName, b.yearLevel, b.building].some((field) => field?.toLowerCase().includes(text)),
        )
      : bookings
    return [...found].sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [bookings, query])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-50 mt-1 w-[340px] rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="border-b border-[var(--line)] p-2">
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter' && matches[0]) onPick(matches[0].id)
            }}
            placeholder="School, year level or building…"
            aria-label="Find a school"
          />
        </div>
        <ul className="max-h-[320px] overflow-y-auto p-1">
          {matches.map((booking) => (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() => onPick(booking.id)}
                className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
              >
                <span className="block truncate text-[12.5px] font-semibold text-[var(--ink)]">
                  {booking.schoolName || 'Unnamed school'}
                </span>
                <span className="tnum block truncate text-[11px] text-[var(--ink-faint)]">
                  {termWeekOf(booking.startDate).label} · {formatDate(booking.startDate)}
                  {booking.endDate !== booking.startDate ? ` – ${formatDate(booking.endDate)}` : ''}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-3 text-[12px] text-[var(--ink-faint)]">
              {bookings.length === 0 ? 'No schools added yet.' : `No school matches “${query.trim()}”.`}
            </li>
          )}
        </ul>
      </div>
    </>
  )
}
