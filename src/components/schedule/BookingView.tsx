import { useMemo, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { DAY_TEMPLATES } from '@/data/templates'
import { bookingDates, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { weekdayShort } from '@/lib/time'
import { ScheduleGrid } from './ScheduleGrid'
import { TimeAxis } from './TimeAxis'
import { Button, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 30

/** The main editing surface: one school, one day, a column per group. */
export function BookingView({
  booking, date, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail,
  onSelect, onClearSelection, onDateChange, onApplyTemplate, onOpenRotation,
  onClearDay, onEditBooking, onEmptyDoubleClick,
}: {
  booking: Booking
  date: string
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
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onDateChange: (date: string) => void
  onApplyTemplate: (templateId: string) => void
  onOpenRotation: () => void
  onClearDay: () => void
  onEditBooking: () => void
  onEmptyDoubleClick: (groupIndex: number, startMin: number) => void
}) {
  const [templateOpen, setTemplateOpen] = useState(false)

  const dates = useMemo(() => bookingDates(booking), [booking])
  const dayBlocks = useMemo(
    () => blocks.filter((block) => block.bookingId === booking.id && block.date === date),
    [blocks, booking.id, date],
  )

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-col gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
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
                Day template &#9662;
              </Button>
              {templateOpen && (
                <Dropdown onClose={() => setTemplateOpen(false)}>
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
                      <span className="block text-[11px] text-[var(--ink-faint)]">
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
              Clear day
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {dates.map((option, index) => {
            return (
              <button
                key={option}
                type="button"
                onClick={() => onDateChange(option)}
                className={cx(
                  'relative rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors',
                  option === date
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
                )}
              >
                <span className="tnum">
                  Day {index + 1} · {weekdayShort(option)}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-auto">
        <TimeAxis
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          zoom={zoom}
          headerHeight={HEADER_HEIGHT}
        />
        <div className="min-w-0 flex-1">
          <ScheduleGrid
            gridId={`booking:${booking.id}:${date}`}
            booking={booking}
            date={date}
            blocks={dayBlocks}
            activities={activities}
            venueNames={venueNames}
            selection={selection}
            highlightIds={highlightIds}
            dayStartMin={dayStartMin}
            dayEndMin={dayEndMin}
            zoom={zoom}
            dark={dark}
            showDetail={showDetail}
            onSelect={onSelect}
            onBackgroundClick={onClearSelection}
            onEmptyDoubleClick={onEmptyDoubleClick}
          />
        </div>
      </div>
    </section>
  )
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </>
  )
}
