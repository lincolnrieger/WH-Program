import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { PACKAGE_LABELS } from '@/types'
import type { PlanMode } from '@/store/persist'
import { DAY_TEMPLATES } from '@/data/templates'
import { bookingDates } from '@/lib/exportImport'
import { formatDate, weekdayShort } from '@/lib/time'
import { ScheduleGrid } from './ScheduleGrid'
import { TimeAxis } from './TimeAxis'
import { Button, EmptyState, cx } from '@/components/ui/primitives'

const HEADER_HEIGHT = 30
const STAY_HEADER_HEIGHT = 52
const STAY_GROUP_HEIGHT = 20

/**
 * The main editing surface for one school.
 *
 * **One day** is a column per group for the day picked in the week bar — the
 * close-up you build in. **Whole stay** lays every day of the visit out side
 * by side against the same time axis, which is the view you want when you're
 * checking a group doesn't do the tube slide twice, or dragging Wednesday's
 * spare session back to Tuesday.
 */
export function BookingView({
  booking, date, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail, showTimes,
  mode, onMode,
  onSelect, onClearSelection, onDateChange, onApplyTemplate, onOpenRotation,
  onClearDay, onEditBooking, onDeleteBooking, onExportSpreadsheet, onAddSchool,
  onEmptyDoubleClick,
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
  showTimes: boolean
  mode: PlanMode
  onMode: (mode: PlanMode) => void
  onSelect: (blockId: string, additive: boolean) => void
  onClearSelection: () => void
  onDateChange: (date: string) => void
  onApplyTemplate: (templateId: string) => void
  onOpenRotation: () => void
  onClearDay: () => void
  onEditBooking: () => void
  onDeleteBooking: () => void
  onExportSpreadsheet: () => void
  /** Starts a new school arriving on the given day. */
  onAddSchool: (date: string) => void
  onEmptyDoubleClick: (groupIndex: number, startMin: number) => void
}) {
  const [menu, setMenu] = useState<'template' | 'more' | null>(null)

  const dates = useMemo(() => bookingDates(booking), [booking])
  const forBooking = useMemo(
    () => blocks.filter((block) => block.bookingId === booking.id),
    [blocks, booking.id],
  )
  const dayBlocks = useMemo(
    () => forBooking.filter((block) => block.date === date),
    [forBooking, date],
  )

  const stay = mode === 'stay'
  const dayIndex = dates.indexOf(date)
  const onSite = dayIndex >= 0
  const suggested = suggestTemplate(dayIndex, dates.length)

  const details = [
    booking.yearLevel,
    booking.studentCount ? `${booking.studentCount} students` : '',
    `${booking.groups.length} group${booking.groups.length === 1 ? '' : 's'}`,
    booking.packageTier === 'custom' ? '' : PACKAGE_LABELS[booking.packageTier],
    booking.building,
  ].filter(Boolean)

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="no-print flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] leading-tight font-semibold text-[var(--ink)]">
            {booking.schoolName || 'Unnamed school'}
          </h1>
          <p className="truncate text-[12px] leading-tight text-[var(--ink-soft)]">
            {details.join(' · ')}
            <button
              type="button"
              onClick={onEditBooking}
              className="ml-2 font-medium text-[var(--brand)] underline-offset-2 hover:underline"
            >
              Edit details
            </button>
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Show"
            className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-sunk)] p-0.5"
          >
            {([
              ['day', 'One day'],
              ['stay', 'Whole stay'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onMode(value)}
                aria-pressed={mode === value}
                className={cx(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                  mode === value
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {!stay && onSite && (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => setMenu((open) => (open === 'template' ? null : 'template'))}
                aria-expanded={menu === 'template'}
              >
                Day template
                <span aria-hidden className="text-[9px] opacity-60">
                  &#9662;
                </span>
              </Button>
              {menu === 'template' && (
                <Dropdown onClose={() => setMenu(null)}>
                  <p className="border-b border-[var(--line)] px-3 pt-1.5 pb-2 text-[11px] leading-snug text-[var(--ink-soft)]">
                    Lays the meals and logistics onto{' '}
                    <strong className="font-medium text-[var(--ink)]">{formatDate(date)}</strong> at
                    the standard times. Activities already placed stay put.
                  </p>
                  {DAY_TEMPLATES.map((template) => (
                    <MenuItem
                      key={template.id}
                      label={template.name}
                      detail={template.description}
                      badge={template.id === suggested ? 'Suggested' : undefined}
                      onClick={() => {
                        onApplyTemplate(template.id)
                        setMenu(null)
                      }}
                    />
                  ))}
                </Dropdown>
              )}
            </div>
          )}

          <Button size="sm" variant="primary" onClick={onOpenRotation}>
            Add activities
          </Button>

          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMenu((open) => (open === 'more' ? null : 'more'))}
              aria-expanded={menu === 'more'}
              aria-label="More for this school"
              title="More for this school"
            >
              More
              <span aria-hidden className="text-[9px] opacity-60">
                &#9662;
              </span>
            </Button>
            {menu === 'more' && (
              <Dropdown onClose={() => setMenu(null)}>
                <MenuItem
                  label="Edit details"
                  detail="Name, dates, groups and building."
                  onClick={() => {
                    setMenu(null)
                    onEditBooking()
                  }}
                />
                <MenuItem
                  label="Save as a spreadsheet"
                  detail="This school's itinerary as .xlsx."
                  onClick={() => {
                    setMenu(null)
                    onExportSpreadsheet()
                  }}
                />
                {!stay && onSite && (
                  <MenuItem
                    label={`Clear ${weekdayShort(date)} ${Number(date.slice(8))}`}
                    detail="Removes everything on this day. Undo brings it back."
                    disabled={dayBlocks.length === 0}
                    onClick={() => {
                      setMenu(null)
                      onClearDay()
                    }}
                  />
                )}
                <div className="my-1 border-t border-[var(--line)]" />
                <MenuItem
                  label="Delete this school"
                  detail={`And its ${forBooking.length} session${forBooking.length === 1 ? '' : 's'}. Undo brings it back.`}
                  danger
                  onClick={() => {
                    setMenu(null)
                    onDeleteBooking()
                  }}
                />
              </Dropdown>
            )}
          </div>
        </div>
      </header>

      {!stay && !onSite ? (
        <EmptyState
          title={`${booking.schoolName || 'This school'} isn’t on site on ${weekdayShort(date)} ${Number(date.slice(8))}`}
          body={`Their stay is ${formatDate(booking.startDate)}${booking.endDate !== booking.startDate ? ` – ${formatDate(booking.endDate)}` : ''}, and no other school is here that day.`}
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => onDateChange(booking.startDate)}>
                Go to their first day
              </Button>
              <Button onClick={() => onAddSchool(date)}>Add a school arriving that day</Button>
            </div>
          }
        />
      ) : (
      <div className="flex min-h-0 flex-1 overflow-auto">
        <TimeAxis
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          zoom={zoom}
          headerHeight={stay ? STAY_HEADER_HEIGHT + STAY_GROUP_HEIGHT : HEADER_HEIGHT}
        />

        {stay ? (
          <div className="flex min-w-0 flex-1">
            {dates.map((day, index) => {
              const columnMin = Math.max(booking.groups.length * 104, 168)
              return (
                <div
                  key={day}
                  className="flex min-w-0 flex-col border-r border-[var(--line-strong)] last:border-r-0"
                  style={{ flex: `1 1 ${columnMin}px`, minWidth: columnMin }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onDateChange(day)
                      onMode('day')
                    }}
                    title="Open this day on its own"
                    className={cx(
                      'sticky top-0 z-40 shrink-0 border-b border-[var(--line)] px-2 py-1 text-left transition-colors',
                      day === date
                        ? 'bg-[var(--brand-tint)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-sunk)]',
                    )}
                    style={{ height: STAY_HEADER_HEIGHT }}
                  >
                    <span className="block text-[11.5px] leading-tight font-semibold text-[var(--ink)]">
                      Day {index + 1} · {weekdayShort(day)}
                    </span>
                    <span className="tnum block text-[10.5px] text-[var(--ink-faint)]">
                      {formatDate(day)}
                    </span>
                  </button>

                  {/* The grid's own heading row isn't sticky, so the group
                      names are drawn here where they can be — and at a known
                      height, which is what keeps every day level with the
                      time axis beside them. */}
                  <div
                    className="sticky z-30 grid shrink-0 border-b border-[var(--line)] bg-[var(--surface)]"
                    style={{
                      top: STAY_HEADER_HEIGHT,
                      height: STAY_GROUP_HEIGHT,
                      gridTemplateColumns: `repeat(${Math.max(booking.groups.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {booking.groups.map((group) => (
                      <span
                        key={group.id}
                        className="truncate border-l border-[var(--line)] px-1 text-center text-[10px] leading-[19px] font-medium text-[var(--ink-faint)] first:border-l-0"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>

                  <ScheduleGrid
                    gridId={`stay:${booking.id}:${day}`}
                    compact
                    booking={booking}
                    date={day}
                    blocks={forBooking.filter((block) => block.date === day)}
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
                    onSelect={onSelect}
                    onBackgroundClick={onClearSelection}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="relative min-w-0 flex-1">
            {dayBlocks.length === 0 && (
              <EmptyDay
                dayNumber={dayIndex + 1}
                date={date}
                suggested={suggested}
                onApplyTemplate={onApplyTemplate}
              />
            )}
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
              showTimes={showTimes}
              onSelect={onSelect}
              onBackgroundClick={onClearSelection}
              onEmptyDoubleClick={onEmptyDoubleClick}
            />
          </div>
        )}
      </div>
      )}
    </section>
  )
}

/**
 * The day template that fits where a day falls in the stay: arrive on the
 * first, leave on the last, a full program in between, and a day visit when
 * the stay is one day long.
 */
function suggestTemplate(dayIndex: number, days: number): string {
  if (days === 1) return 'day-visit'
  if (dayIndex === 0) return 'arrival-day'
  if (dayIndex === days - 1) return 'departure-day'
  return 'full-day'
}

/**
 * What an empty day says: the two ways to start one, with the template that
 * fits this day of the stay offered first.
 */
function EmptyDay({
  dayNumber,
  date,
  suggested,
  onApplyTemplate,
}: {
  dayNumber: number
  date: string
  suggested: string
  onApplyTemplate: (templateId: string) => void
}) {
  const first = DAY_TEMPLATES.find((template) => template.id === suggested) ?? DAY_TEMPLATES[0]
  const others = DAY_TEMPLATES.filter((template) => template.id !== first.id)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[440px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
        <p className="text-[14px] font-semibold text-[var(--ink)]">
          Nothing planned for Day {dayNumber} yet
        </p>
        <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
          Start {formatDate(date)} with the meals and logistics at their usual times, then drag
          activities into the gaps.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button variant="primary" onClick={() => onApplyTemplate(first.id)}>
            Use {first.name.toLowerCase()}
          </Button>
          {others.map((template) => (
            <Button key={template.id} size="sm" variant="ghost" onClick={() => onApplyTemplate(template.id)}>
              {template.name}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-[var(--ink-faint)]">
          Or drag straight from the activity list. Double-click an empty spot for a blank block.
        </p>
      </div>
    </div>
  )
}

function MenuItem({
  label,
  detail,
  badge,
  danger,
  disabled,
  onClick,
}: {
  label: string
  detail: string
  badge?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)] disabled:pointer-events-none disabled:opacity-45"
    >
      <span
        className={cx(
          'flex items-center gap-2 text-[12.5px] font-medium',
          danger ? 'text-[var(--danger)]' : 'text-[var(--ink)]',
        )}
      >
        {label}
        {badge && (
          <span className="rounded-full bg-[var(--brand-tint)] px-1.5 py-px text-[10px] font-semibold text-[var(--brand)]">
            {badge}
          </span>
        )}
      </span>
      <span className="block text-[11px] leading-snug text-[var(--ink-faint)]">{detail}</span>
    </button>
  )
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 z-50 mt-1 w-[268px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </>
  )
}
