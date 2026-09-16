import { Fragment, useMemo, useState } from 'react'
import type { Activity, Block, Booking, Delivery } from '@/types'
import { DELIVERY_LABELS } from '@/types'
import { rotationMatrix, suggestSlots, type RotationSlot } from '@/lib/rotation'
import { bookingDates } from '@/lib/exportImport'
import { formatDate, formatDuration, formatTimeFull, weekdayShort } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button, Chip, Field, Select, cx } from '@/components/ui/primitives'

/**
 * Generates the rotation staff currently build by hand: every group does every
 * activity once, and no two groups are ever on the same one at the same time.
 *
 * The rotation can cover any set of days in the stay at once. Across days it
 * keeps counting rather than restarting, so a three-day camp with four slots a
 * day works through twelve activities instead of repeating the first four.
 */
export function RotationDialog({
  booking,
  date,
  blocks,
  activities,
  dayStartMin,
  dayEndMin,
  onGenerate,
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
    delivery: Delivery
    continueAcrossDays: boolean
    replaceExisting: boolean
  }) => void
  onClose: () => void
}) {
  const stayDates = useMemo(() => bookingDates(booking), [booking])

  const [dates, setDates] = useState<string[]>([date])
  const [activityIds, setActivityIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>(() => booking.groups.map((g) => g.id))
  const [delivery, setDelivery] = useState<Delivery>('staff')
  const [continueAcrossDays, setContinueAcrossDays] = useState(true)
  const [replaceExisting, setReplaceExisting] = useState(false)

  // Slots come from the gaps on the first selected day: the meals and logistics
  // sit at the same times every day, so one day's shape does for all of them.
  const shapeDay = dates[0] ?? date
  const suggested = useMemo(
    () =>
      suggestSlots(
        blocks.filter((b) => b.date === shapeDay),
        { dayStart: dayStartMin, dayEnd: dayEndMin, minLength: 45 },
      ),
    [blocks, shapeDay, dayStartMin, dayEndMin],
  )

  const [droppedSlots, setDroppedSlots] = useState<number[]>([])
  const slots = suggested.filter((_, index) => !droppedSlots.includes(index))

  const canGenerate = dates.length > 0 && slots.length > 0 && activityIds.length > 0 && groupIds.length > 0
  const perDay = slots.length * Math.min(groupIds.length, activityIds.length)
  const total = perDay * dates.length

  const matrix = useMemo(
    () =>
      canGenerate
        ? rotationMatrix({ dates, slots, activityIds, groupIds, continueAcrossDays })
        : [],
    [canGenerate, dates, slots, activityIds, groupIds, continueAcrossDays],
  )

  const activityById = useMemo(
    () => new Map(activities.map((a) => [a.id, a])),
    [activities],
  )

  const shortOfActivities = groupIds.length > activityIds.length && activityIds.length > 0
  const slotsNeeded = dates.length * slots.length
  const repeats = continueAcrossDays && activityIds.length > 0 && slotsNeeded > activityIds.length

  function toggleDate(day: string) {
    setDates((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a.localeCompare(b)),
    )
  }

  return (
    <Modal
      title="Build a rotation"
      description={booking.schoolName}
      width={760}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canGenerate}
            onClick={() => {
              onGenerate({
                dates,
                slots,
                activityIds,
                groupIds,
                delivery,
                continueAcrossDays,
                replaceExisting,
              })
              onClose()
            }}
          >
            Create {total} block{total === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={`Days (${dates.length} of ${stayDates.length})`}
          hint="The rotation is laid over every day you pick, using the same time slots."
        >
          <div className="flex flex-wrap items-center gap-1">
            {stayDates.map((day, index) => (
              <Chip key={day} active={dates.includes(day)} onClick={() => toggleDate(day)}>
                <span className="tnum">
                  Day {index + 1} · {weekdayShort(day)} {Number(day.slice(8))}
                </span>
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden />
            <Button size="sm" variant="ghost" onClick={() => setDates(stayDates)}>
              All days
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDates([date])}>
              Just {weekdayShort(date)}
            </Button>
          </div>
        </Field>

        <Field
          label="Time slots"
          hint={`Taken from the gaps left on ${formatDate(shapeDay)} by the meals and logistics already there.`}
        >
          {suggested.length === 0 ? (
            <p className="text-[12px] text-[var(--ink-soft)]">
              No free slots found on {formatDate(shapeDay)}. Apply a day template to that day first,
              or clear some blocks.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {suggested.map((slot, index) => (
                <Chip
                  key={index}
                  active={!droppedSlots.includes(index)}
                  onClick={() =>
                    setDroppedSlots((current) =>
                      current.includes(index)
                        ? current.filter((i) => i !== index)
                        : [...current, index],
                    )
                  }
                >
                  {formatTimeFull(slot.startMin)}–{formatTimeFull(slot.endMin)}
                  <span className="ml-1 opacity-60">
                    {formatDuration(slot.endMin - slot.startMin)}
                  </span>
                </Chip>
              ))}
            </div>
          )}
        </Field>

        <Field label="Groups">
          <div className="flex flex-wrap gap-1">
            {booking.groups.map((group) => (
              <Chip
                key={group.id}
                active={groupIds.includes(group.id)}
                onClick={() =>
                  setGroupIds((current) =>
                    current.includes(group.id)
                      ? current.filter((id) => id !== group.id)
                      : [...current, group.id],
                  )
                }
              >
                {group.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label={`Activities (${activityIds.length} chosen)`}
          hint={`Pick at least as many as there are groups. ${slotsNeeded} slot${
            slotsNeeded === 1 ? '' : 's'
          } across the days you've chosen.`}
        >
          <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--line)] p-1">
            <div className="flex flex-wrap gap-1">
              {activities.map((activity) => {
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
                    {index >= 0 && <span className="tnum opacity-60">{index + 1}.</span>}
                    {activity.name}
                  </Chip>
                )
              })}
            </div>
          </div>
          {shortOfActivities && (
            <p className="mt-1 text-[11.5px] text-[var(--warn)]">
              {groupIds.length} groups but only {activityIds.length} activities — the last{' '}
              {groupIds.length - activityIds.length} group(s) will be left empty rather than
              doubled up.
            </p>
          )}
          {repeats && (
            <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">
              {slotsNeeded} slots and {activityIds.length} activities — the rotation will come
              back around and repeat some.
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery">
            <Select value={delivery} onChange={(event) => setDelivery(event.target.value as Delivery)}>
              {(['staff', 'teacher_led', 'self_led'] as const).map((value) => (
                <option key={value} value={value}>
                  {DELIVERY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col justify-end gap-1 pb-0.5">
            <Toggle
              label="Carry on across days"
              hint="Off restarts the rotation each morning, so every day looks the same."
              checked={continueAcrossDays}
              onChange={setContinueAcrossDays}
            />
            <Toggle
              label="Replace activities already there"
              hint="Meals and logistics are left alone either way."
              checked={replaceExisting}
              onChange={setReplaceExisting}
            />
          </div>
        </div>

        {matrix.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
              Preview · {total} blocks over {dates.length} day{dates.length === 1 ? '' : 's'}
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-[var(--line)]">
              <table className="w-full border-collapse text-[11.5px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--surface-sunk)]">
                    <th className="px-2 py-1 text-left font-medium text-[var(--ink-faint)]">Time</th>
                    {groupIds.map((groupId) => (
                      <th key={groupId} className="px-2 py-1 text-left font-medium text-[var(--ink-faint)]">
                        {booking.groups.find((g) => g.id === groupId)?.name}
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
                          <tr className="bg-[var(--brand-tint)]">
                            <td
                              colSpan={groupIds.length + 1}
                              className="px-2 py-1 text-[11px] font-semibold text-[var(--brand)]"
                            >
                              {formatDate(row.date)}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-[var(--line)]">
                          <td className="tnum px-2 py-1 whitespace-nowrap text-[var(--ink-soft)]">
                            {formatTimeFull(row.slot.startMin)}
                          </td>
                          {row.activityIds.map((activityId, cellIndex) => {
                            const activity = activityId ? activityById.get(activityId) : undefined
                            return (
                              <td key={cellIndex} className="px-2 py-1">
                                {activity ? (
                                  <span
                                    className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5')}
                                    style={{
                                      background: `color-mix(in srgb, ${activity.colour} 16%, transparent)`,
                                    }}
                                  >
                                    <span
                                      aria-hidden
                                      className="h-2 w-2 rounded-full"
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
          </div>
        )}
      </div>
    </Modal>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      title={hint}
      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px] text-[var(--ink)] hover:bg-[var(--surface-sunk)]"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-[var(--brand)]"
      />
      {label}
    </label>
  )
}
