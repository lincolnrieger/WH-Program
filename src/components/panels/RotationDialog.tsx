import { useMemo, useState } from 'react'
import type { Activity, Block, Booking, Delivery } from '@/types'
import { DELIVERY_LABELS } from '@/types'
import { suggestSlots, type RotationSlot } from '@/lib/rotation'
import { formatDate, formatDuration, formatTimeFull } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button, Chip, Field, Select, cx } from '@/components/ui/primitives'

/**
 * Generates the rotation staff currently build by hand: every group does every
 * activity once, and no two groups are ever on the same one at the same time.
 */
export function RotationDialog({
  booking,
  date,
  existingBlocks,
  activities,
  dayStartMin,
  dayEndMin,
  onGenerate,
  onClose,
}: {
  booking: Booking
  date: string
  existingBlocks: Block[]
  activities: Activity[]
  dayStartMin: number
  dayEndMin: number
  onGenerate: (input: {
    slots: RotationSlot[]
    activityIds: string[]
    groupIds: string[]
    delivery: Delivery
  }) => void
  onClose: () => void
}) {
  const suggested = useMemo(
    () => suggestSlots(existingBlocks, { dayStart: dayStartMin, dayEnd: dayEndMin, minLength: 45 }),
    [existingBlocks, dayStartMin, dayEndMin],
  )

  const [slotIndexes, setSlotIndexes] = useState<number[]>(() =>
    suggested.map((_, index) => index),
  )
  const [activityIds, setActivityIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>(() => booking.groups.map((g) => g.id))
  const [delivery, setDelivery] = useState<Delivery>('staff')

  const slots = slotIndexes.map((index) => suggested[index]).filter(Boolean)
  const canGenerate = slots.length > 0 && activityIds.length > 0 && groupIds.length > 0

  // Preview the matrix so it's obvious what will be created before committing.
  const preview = useMemo(() => {
    if (!canGenerate) return []
    return slots.map((slot, slotIndex) => ({
      slot,
      cells: groupIds.map((groupId, groupIndex) => {
        if (groupIndex >= activityIds.length) return null
        const activityId = activityIds[(slotIndex + groupIndex) % activityIds.length]
        return { groupId, activity: activities.find((a) => a.id === activityId) }
      }),
    }))
  }, [canGenerate, slots, groupIds, activityIds, activities])

  const shortOfActivities = groupIds.length > activityIds.length && activityIds.length > 0

  return (
    <Modal
      title="Build a rotation"
      description={`${booking.schoolName} — ${formatDate(date)}`}
      width={720}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canGenerate}
            onClick={() => {
              onGenerate({ slots, activityIds, groupIds, delivery })
              onClose()
            }}
          >
            Create {slots.length * Math.min(groupIds.length, activityIds.length)} blocks
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Time slots" hint="Taken from the gaps left by the meals and logistics already on this day.">
          {suggested.length === 0 ? (
            <p className="text-[12px] text-[var(--ink-soft)]">
              No free slots found. Apply a day template first, or clear some blocks.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {suggested.map((slot, index) => (
                <Chip
                  key={index}
                  active={slotIndexes.includes(index)}
                  onClick={() =>
                    setSlotIndexes((current) =>
                      current.includes(index)
                        ? current.filter((i) => i !== index)
                        : [...current, index].sort((a, b) => a - b),
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
          hint="Pick at least as many activities as there are groups so nobody doubles up."
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
        </Field>

        <Field label="Delivery">
          <Select value={delivery} onChange={(event) => setDelivery(event.target.value as Delivery)}>
            {(['staff', 'teacher_led', 'self_led'] as const).map((value) => (
              <option key={value} value={value}>
                {DELIVERY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        {preview.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
              Preview
            </p>
            <div className="overflow-x-auto rounded-md border border-[var(--line)]">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
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
                  {preview.map(({ slot, cells }, index) => (
                    <tr key={index} className="border-t border-[var(--line)]">
                      <td className="tnum px-2 py-1 whitespace-nowrap text-[var(--ink-soft)]">
                        {formatTimeFull(slot.startMin)}
                      </td>
                      {cells.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-2 py-1">
                          {cell?.activity ? (
                            <span
                              className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5')}
                              style={{
                                background: `color-mix(in srgb, ${cell.activity.colour} 16%, transparent)`,
                              }}
                            >
                              <span
                                aria-hidden
                                className="h-2 w-2 rounded-full"
                                style={{ background: cell.activity.colour }}
                              />
                              {cell.activity.name}
                            </span>
                          ) : (
                            <span className="text-[var(--ink-faint)]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
