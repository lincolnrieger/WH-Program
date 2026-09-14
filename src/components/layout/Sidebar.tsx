import { useMemo, useState } from 'react'
import type { Activity, Booking, Issue, Site } from '@/types'
import { PACKAGE_LABELS } from '@/types'
import { formatDate } from '@/lib/time'
import { ActivityPalette } from '@/components/palette/ActivityPalette'
import { ConflictPanel } from '@/components/panels/ConflictPanel'
import { Button, SectionTitle, cx } from '@/components/ui/primitives'

type Tab = 'activities' | 'bookings' | 'checks'

export function Sidebar({
  activities, site, dark, search, onSearch, onQuickAdd, canAdd,
  bookings, activeBookingId, onSelectBooking, onNewBooking, onEditBooking,
  issues, onFocusIssue,
}: {
  activities: Activity[]
  site: Site
  dark: boolean
  search: string
  onSearch: (value: string) => void
  onQuickAdd: (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => void
  canAdd: boolean
  bookings: Booking[]
  activeBookingId: string | null
  onSelectBooking: (id: string) => void
  onNewBooking: () => void
  onEditBooking: (id: string) => void
  issues: Issue[]
  onFocusIssue: (issue: Issue) => void
}) {
  const [tab, setTab] = useState<Tab>('activities')

  const errorCount = useMemo(
    () => issues.filter((issue) => issue.severity === 'error').length,
    [issues],
  )

  return (
    <nav className="no-print flex h-full w-[264px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
      <div role="tablist" className="flex shrink-0 border-b border-[var(--line)]">
        {([
          ['activities', 'Activities'],
          ['bookings', 'Schools'],
          ['checks', 'Checks'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              'relative flex-1 px-2 py-2 text-[12px] font-medium transition-colors',
              tab === key
                ? 'text-[var(--ink)]'
                : 'text-[var(--ink-faint)] hover:text-[var(--ink-soft)]',
            )}
          >
            {label}
            {key === 'checks' && errorCount > 0 && (
              <span className="tnum ml-1 rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-semibold text-white">
                {errorCount}
              </span>
            )}
            {tab === key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand)]" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'activities' && (
          <ActivityPalette
            activities={activities}
            site={site}
            dark={dark}
            search={search}
            onSearch={onSearch}
            onQuickAdd={onQuickAdd}
            canAdd={canAdd}
          />
        )}

        {tab === 'bookings' && (
          <div className="flex h-full min-h-0 flex-col">
            <SectionTitle
              right={
                <Button size="sm" variant="primary" onClick={onNewBooking}>
                  + School
                </Button>
              }
            >
              On site
            </SectionTitle>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {bookings.length === 0 && (
                <p className="px-1 py-4 text-[12px] text-[var(--ink-faint)]">
                  No schools yet. Add one to start building an itinerary.
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {bookings.map((booking) => (
                  <li key={booking.id}>
                    <div
                      className={cx(
                        'group rounded-md border transition-colors',
                        booking.id === activeBookingId
                          ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-sunk)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBooking(booking.id)}
                        className="w-full px-2 py-1.5 text-left"
                      >
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--ink)]">
                          {booking.schoolName}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--ink-soft)]">
                          {[booking.yearLevel, PACKAGE_LABELS[booking.packageTier], booking.building]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="tnum block truncate text-[10.5px] text-[var(--ink-faint)]">
                          {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                          {booking.studentCount ? ` · ${booking.studentCount} students` : ''}
                        </span>
                      </button>
                      <div className="flex justify-end px-1 pb-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button size="sm" variant="ghost" onClick={() => onEditBooking(booking.id)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'checks' && <ConflictPanel issues={issues} onFocus={onFocusIssue} />}
      </div>
    </nav>
  )
}
