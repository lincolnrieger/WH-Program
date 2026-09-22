import { useMemo, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { DAY_TEMPLATES } from '@/data/templates'
import { bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate } from '@/lib/time'
import { Spread } from './Spread'
import { Button, EmptyState } from '@/components/ui/primitives'

/**
 * The main editing surface for one school.
 *
 * Which days it shows is chosen in the day strip at the top of the window, not
 * here — one day to build it, the whole stay to check a group isn't doing the
 * tube slide twice. Everything in this header acts on the day the strip has
 * marked as active, which is the one drawn in green.
 */
export function BookingView({
  booking, date, days, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail, showTimes,
  onSelect, onClearSelection, onFocusDay, onApplyTemplate, onOpenRotation,
  onClearDay, onEditBooking, onEmptyDoubleClick,
}: {
  booking: Booking
  /** The day the header's tools act on. */
  date: string
  /** Every day on screen — already narrowed to the days of this visit. */
  days: string[]
  blocks: Block[]
  activities: Map<string, Activity>
  venueNames: Map<string, string>
  selection: string[]
  highlightIds: string[]
  dayStartMin: number
  dayEndMin: number
  zoom: number
  dark: boolean
  showDetail: boolean
  showTimes: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onFocusDay: (date: string) => void
  onApplyTemplate: (templateId: string) => void
  onOpenRotation: () => void
  onClearDay: () => void
  onEditBooking: () => void
  onEmptyDoubleClick: (date: string, groupIndex: number, startMin: number) => void
}) {
  const [templateOpen, setTemplateOpen] = useState(false)

  const forBooking = useMemo(
    () => blocks.filter((block) => block.bookingId === booking.id),
    [blocks, booking.id],
  )

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <button
          type="button"
          onClick={onEditBooking}
          className="min-w-0 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
        >
          <span className="block truncate text-[14px] leading-tight font-semibold text-[var(--ink)]">
            {bookingHeadline(booking)}
          </span>
          <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
            {bookingSubhead(booking)}
          </span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Button size="sm" onClick={() => setTemplateOpen((open) => !open)}>
              Day template
              <span aria-hidden className="text-[9px] opacity-60">
                &#9662;
              </span>
            </Button>
            {templateOpen && (
              <Dropdown onClose={() => setTemplateOpen(false)}>
                <p className="border-b border-[var(--line)] px-3 pt-1.5 pb-2 text-[11px] leading-snug text-[var(--ink-soft)]">
                  Lays the meals and logistics onto{' '}
                  <strong className="font-medium text-[var(--ink)]">{formatDate(date)}</strong> at
                  the standard times, so only the activities are left to place.
                </p>
                {DAY_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onApplyTemplate(template.id)
                      setTemplateOpen(false)
                    }}
                    className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                  >
                    <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                      {template.name}
                    </span>
                    <span className="block text-[11px] leading-snug text-[var(--ink-faint)]">
                      {template.description}
                    </span>
                  </button>
                ))}
              </Dropdown>
            )}
          </div>

          <Button size="sm" variant="primary" onClick={onOpenRotation}>
            Add activities
          </Button>

          <Button size="sm" variant="ghost" onClick={onClearDay}>
            Clear {days.length > 1 ? formatDate(date) : 'day'}
          </Button>
        </div>
      </header>

      {days.length === 0 ? (
        <EmptyState
          title={`${booking.schoolName} isn't here then`}
          body="Pick a day of this school's visit in the strip at the top — or use its Stay button to see the whole thing."
        />
      ) : (
        <Spread
          gridScope="plan"
          days={days}
          bookings={[booking]}
          activeDate={date}
          blocks={forBooking}
          activities={activities}
          venueNames={venueNames}
          selection={selection}
          highlightIds={highlightIds}
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          zoom={zoom}
          dark={dark}
          showDetail={showDetail}
          showTimes={showTimes}
          showSchoolNames={false}
          onSelect={onSelect}
          onClearSelection={onClearSelection}
          onFocusDay={onFocusDay}
          onEmptyDoubleClick={(_bookingId, day, groupIndex, startMin) =>
            onEmptyDoubleClick(day, groupIndex, startMin)
          }
        />
      )}
    </section>
  )
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-50 mt-1 w-[268px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </>
  )
}
