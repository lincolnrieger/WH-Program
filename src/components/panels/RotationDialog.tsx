import { Fragment, useMemo, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { rotationMatrix, suggestSlots, type RotationSlot } from '@/lib/rotation'
import { bookingDates } from '@/lib/exportImport'
import { formatDate, formatTimeFull, weekdayShort } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button, Chip, Input, cx } from '@/components/ui/primitives'

type Mode = 'manual' | 'automatic'

/**
 * Pick the activities for a stay, then say how they should land.
 *
 * Two questions, in that order, because that is the order the decision gets
 * made in: *which* activities, then *let me place them* or *fill the timetable
 * for me*. Everything the automatic option needs is tucked under it, so the
 * manual route — which is most of the time — is two clicks and nothing else.
 */
export function RotationDialog({
  booking,
  date,
  blocks,
  activities,
  dayStartMin,
  dayEndMin,
  onGenerate,
  onAddToList,
  onClose,
}: {
  booking: Booking
  /** The day the planner was looking at — the default selection. */
  date: string
  /** Every block for this booking, so each day's free slots can be worked out. */
  blocks: Block[]
  activities: Activity[]
  dayStartMin: number
  dayEndMin: number
  onGenerate: (input: {
    dates: string[]
    slots: RotationSlot[]
    activityIds: string[]
    groupIds: string[]
    delivery: 'staff'
    continueAcrossDays: boolean
    replaceExisting: boolean
  }) => void
  /** Sends the chosen activities to the palette instead of arranging them. */
  onAddToList: (activityIds: string[]) => void
  onClose: () => void
}) {
  const stayDates = useMemo(() => bookingDates(booking), [booking])

  const [search, setSearch] = useState('')
  const [activityIds, setActivityIds] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('manual')
  const [dates, setDates] = useState<string[]>([date])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const groupIds = useMemo(() => booking.groups.map((g) => g.id), [booking.groups])

  // The meals and logistics sit at the same times every day, so the gaps left
  // on the first chosen day describe all of them.
  const shapeDay = dates[0] ?? date
  const slots = useMemo(
    () =>
      suggestSlots(
        blocks.filter((b) => b.date === shapeDay),
        { dayStart: dayStartMin, dayEnd: dayEndMin, minLength: 45 },
      ),
    [blocks, shapeDay, dayStartMin, dayEndMin],
  )

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activities
    return activities.filter((activity) => activity.name.toLowerCase().includes(query))
  }, [activities, search])

  const chosen = activityIds.length > 0
  const canFill = chosen && dates.length > 0 && slots.length > 0 && groupIds.length > 0
  const total = slots.length * Math.min(groupIds.length, activityIds.length) * dates.length

  const matrix = useMemo(
    () =>
      canFill && showPreview
        ? rotationMatrix({ dates, slots, activityIds, groupIds, continueAcrossDays: true })
        : [],
    [canFill, showPreview, dates, slots, activityIds, groupIds],
  )

  const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities])

  function toggleDate(day: string) {
    setDates((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a.localeCompare(b)),
    )
  }

  return (
    <Modal
      title="Add activities"
      description={booking.schoolName}
      width={680}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={mode === 'manual' ? !chosen : !canFill}
            onClick={() => {
              if (mode === 'manual') {
                onAddToList(activityIds)
              } else {
                onGenerate({
                  dates,
                  slots,
                  activityIds,
                  groupIds,
                  delivery: 'staff',
                  continueAcrossDays: true,
                  replaceExisting,
                })
              }
              onClose()
            }}
          >
            {mode === 'manual'
              ? `Add ${activityIds.length || ''} to the list`.replace('  ', ' ')
              : `Fill ${total} slot${total === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Step number={1} label="Pick the activities">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search…"
            aria-label="Search activities"
            className="mb-1.5"
          />
          <div className="max-h-44 overflow-y-auto rounded-md border border-[var(--line)] p-1">
            <div className="flex flex-wrap gap-1">
              {visible.map((activity) => {
                const index = activityIds.indexOf(activity.id)
                return (
                  <Chip
                    key={activity.id}
                    colour={activity.colour}
                    active={index >= 0}
                    onClick={() =>
                      setActivityIds((current) =>
                        current.includes(activity.id)
                          ? current.filter((id) => id !== activity.id)
                          : [...current, activity.id],
                      )
                    }
                  >
                    {activity.name}
                  </Chip>
                )
              })}
              {visible.length === 0 && (
                <p className="px-1 py-2 text-[12px] text-[var(--ink-faint)]">
                  Nothing matches “{search.trim()}”.
                </p>
              )}
            </div>
          </div>
          <p className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--ink-faint)]">
            <span>
              {activityIds.length === 0
                ? 'None chosen yet.'
                : `${activityIds.length} chosen.`}
            </span>
            {chosen && (
              <button
                type="button"
                onClick={() => setActivityIds([])}
                className="text-[var(--brand)] underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </p>
        </Step>

        <Step number={2} label="Choose how they go in">
          <div className="grid grid-cols-2 gap-2">
            <Choice
              on={mode === 'manual'}
              title="I’ll place them"
              detail="They go to the top of the palette. Drag each one where you want it."
              onClick={() => setMode('manual')}
            />
            <Choice
              on={mode === 'automatic'}
              title="Fill the timetable"
              detail="Every group does every activity once, and no two are on the same one at the same time."
              onClick={() => setMode('automatic')}
            />
          </div>

          {mode === 'automatic' && (
            <div className="mt-2 space-y-2 rounded-lg bg-[var(--surface-sunk)] p-2.5">
              <div>
                <span className="mb-1 block text-[11px] font-medium text-[var(--ink-soft)]">
                  Which days?
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {stayDates.map((day, index) => (
                    <Chip key={day} active={dates.includes(day)} onClick={() => toggleDate(day)}>
                      <span className="tnum">
                        {weekdayShort(day)} {Number(day.slice(8))}
                      </span>
                      <span className="sr-only">Day {index + 1}</span>
                    </Chip>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDates(dates.length === stayDates.length ? [date] : stayDates)}
                    className="ml-1 text-[11.5px] text-[var(--brand)] underline-offset-2 hover:underline"
                  >
                    {dates.length === stayDates.length ? 'Just one day' : 'Every day'}
                  </button>
                </div>
              </div>

              <p className="text-[11.5px] leading-snug text-[var(--ink-soft)]">
                {slots.length === 0 ? (
                  <span className="text-[var(--warn)]">
                    No free time on {formatDate(shapeDay)} to fill. Apply a day template first, or
                    place them yourself.
                  </span>
                ) : (
                  <>
                    Filling the{' '}
                    <strong className="font-medium text-[var(--ink)]">
                      {slots.length} free slot{slots.length === 1 ? '' : 's'}
                    </strong>{' '}
                    on each day ({slots.map((slot) => formatTimeFull(slot.startMin)).join(', ')}) for
                    all {booking.groups.length} group{booking.groups.length === 1 ? '' : 's'}.
                  </>
                )}
              </p>

              {groupIds.length > activityIds.length && chosen && (
                <p className="text-[11.5px] text-[var(--warn)]">
                  {groupIds.length} groups but {activityIds.length} activities — the last{' '}
                  {groupIds.length - activityIds.length} will be left empty rather than doubled up.
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--brand)]"
                />
                Replace activities already on those days
              </label>

              {canFill && (
                <button
                  type="button"
                  onClick={() => setShowPreview((value) => !value)}
                  className="text-[11.5px] text-[var(--brand)] underline-offset-2 hover:underline"
                >
                  {showPreview ? 'Hide preview' : 'Preview it first'}
                </button>
              )}

              {matrix.length > 0 && (
                <div className="max-h-52 overflow-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead className="sticky top-0 bg-[var(--surface-sunk)]">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-[var(--ink-faint)]">
                          Time
                        </th>
                        {booking.groups.map((group) => (
                          <th
                            key={group.id}
                            className="px-2 py-1 text-left font-medium text-[var(--ink-faint)]"
                          >
                            {group.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row, index) => {
                        const newDay = index === 0 || matrix[index - 1].date !== row.date
                        return (
                          <Fragment key={`${row.date}-${row.slot.startMin}`}>
                            {newDay && dates.length > 1 && (
                              <tr>
                                <td
                                  colSpan={booking.groups.length + 1}
                                  className="bg-[var(--brand-tint)] px-2 py-1 text-[11px] font-semibold text-[var(--brand)]"
                                >
                                  {formatDate(row.date)}
                                </td>
                              </tr>
                            )}
                            <tr className="border-t border-[var(--line)]">
                              <td className="tnum px-2 py-1 whitespace-nowrap text-[var(--ink-soft)]">
                                {formatTimeFull(row.slot.startMin)}
                              </td>
                              {row.activityIds.map((activityId, cell) => {
                                const activity = activityId ? activityById.get(activityId) : undefined
                                return (
                                  <td key={cell} className="px-2 py-1">
                                    {activity ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span
                                          aria-hidden
                                          className="h-2 w-2 shrink-0 rounded-full"
                                          style={{ background: activity.colour }}
                                        />
                                        {activity.name}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--ink-faint)]">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Step>
      </div>
    </Modal>
  )
}

function Step({
  number,
  label,
  children,
}: {
  number: number
  label: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink)]">
        <span
          aria-hidden
          className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-[var(--brand-ink)]"
          style={{ height: 18, width: 18 }}
        >
          {number}
        </span>
        {label}
      </h3>
      {children}
    </section>
  )
}

function Choice({
  on,
  title,
  detail,
  onClick,
}: {
  on: boolean
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'rounded-lg border px-3 py-2 text-left transition-colors',
        on
          ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
          : 'border-[var(--line)] hover:bg-[var(--surface-sunk)]',
      )}
    >
      <span className="block text-[12.5px] font-medium text-[var(--ink)]">{title}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--ink-soft)]">{detail}</span>
    </button>
  )
}
