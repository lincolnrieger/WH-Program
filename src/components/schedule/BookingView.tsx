import { useMemo, useState } from 'react'
import type { Activity, Block, Booking, Issue } from '@/types'
import { DAY_TEMPLATES } from '@/data/templates'
import { bookingDates, bookingHeadline, bookingSubhead } from '@/lib/exportImport'
import { formatDate, weekdayShort } from '@/lib/time'
import { ScheduleGrid } from './ScheduleGrid'
import { TimeAxis } from './TimeAxis'
import { Button, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 30

/** The main editing surface: one school, one day, a column per group. */
export function BookingView({
  booking, date, blocks, activities, venueNames, staffNames, issues,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showConflicts, showDetail,
  onSelect, onClearSelection, onDateChange, onApplyTemplate, onOpenRotation,
  onCopyDay, onClearDay, onEditBooking, onEmptyDoubleClick,
}: {
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venueNames: Map<string, string>
  staffNames: Map<string, string>
  issues: Issue[]
  selection: string[]
  highlightIds: string[]
  dayStartMin: number
  dayEndMin: number
  zoom: number
  dark: boolean
  showConflicts: boolean
  showDetail: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onDateChange: (date: string) => void
  onApplyTemplate: (templateId: string) => void
  onOpenRotation: () => void
  onCopyDay: (fromDate: string) => void
  onClearDay: () => void
  onEditBooking: () => void
  onEmptyDoubleClick: (groupIndex: number, startMin: number) => void
}) {
  const [templateOpen, setTemplateOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)

  const dates = useMemo(() => bookingDates(booking), [booking])
  const dayBlocks = useMemo(
    () => blocks.filter((block) => block.bookingId === booking.id && block.date === date),
    [blocks, booking.id, date],
  )

  const dayIssues = useMemo(() => issues.filter((issue) => issue.date === date), [issues, date])

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
              Build rotation
            </Button>

            <div className="relative">
              <Button size="sm" onClick={() => setCopyOpen((open) => !open)}>
                Copy day &#9662;
              </Button>
              {copyOpen && (
                <Dropdown onClose={() => setCopyOpen(false)}>
                  {dates.filter((d) => d !== date).length === 0 && (
                    <p className="px-3 py-2 text-[11.5px] text-[var(--ink-faint)]">
                      This booking only has one day.
                    </p>
                  )}
                  {dates
                    .filter((d) => d !== date)
                    .map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => {
                          onCopyDay(source)
                          setCopyOpen(false)
                        }}
                        className="block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--surface-sunk)]"
                      >
                        Copy {formatDate(source)} here
                      </button>
                    ))}
                </Dropdown>
              )}
            </div>

            <Button size="sm" variant="ghost" onClick={onClearDay}>
              Clear day
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {dates.map((option, index) => {
            const errors = issues.filter(
              (issue) => issue.date === option && issue.severity === 'error',
            ).length
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
                {errors > 0 && (
                  <span
                    aria-label={`${errors} clashes`}
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]"
                  />
                )}
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
            staffNames={staffNames}
            issues={dayIssues}
            selection={selection}
            highlightIds={highlightIds}
            dayStartMin={dayStartMin}
            dayEndMin={dayEndMin}
            zoom={zoom}
            dark={dark}
            showConflicts={showConflicts}
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
