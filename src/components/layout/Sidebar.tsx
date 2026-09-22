import { useState } from 'react'
import type { Activity, Booking, Site } from '@/types'
import { PACKAGE_LABELS } from '@/types'
import { formatDate } from '@/lib/time'
import { ActivityPalette } from '@/components/palette/ActivityPalette'
import { Button, SectionTitle, cx } from '@/components/ui/primitives'

type Tab = 'activities' | 'bookings'

export function Sidebar({
  activities, picked, site, dark, search, onSearch, onQuickAdd, canAdd,
  onAddCustom, onUnpick, onClearPicked,
  bookings, activeBookingId, onSelectBooking, onNewBooking, onEditBooking,
}: {
  activities: Activity[]
  /** Activities set aside for manual dragging, shown above the full list. */
  picked: Activity[]
  site: Site
  dark: boolean
  search: string
  onSearch: (value: string) => void
  onQuickAdd: (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => void
  canAdd: boolean
  onAddCustom: (name: string) => void
  onUnpick: (id: string) => void
  onClearPicked: () => void
  bookings: Booking[]
  activeBookingId: string | null
  onSelectBooking: (id: string) => void
  onNewBooking: () => void
  onEditBooking: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>('activities')

  return (
    <nav className="no-print flex h-full w-[264px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
      <div role="tablist" className="flex shrink-0 border-b border-[var(--line)]">
        {([
          ['activities', 'Activities'],
          ['bookings', 'Schools'],
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
            picked={picked}
            site={site}
            dark={dark}
            search={search}
            onSearch={onSearch}
            onQuickAdd={onQuickAdd}
            canAdd={canAdd}
            onAddCustom={onAddCustom}
            onUnpick={onUnpick}
            onClearPicked={onClearPicked}
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
      </div>
    </nav>
  )
}
