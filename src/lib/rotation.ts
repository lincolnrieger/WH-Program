import type { Activity, Block, Booking, Delivery } from '@/types'
import { uid } from './id'

export interface RotationSlot {
  startMin: number
  endMin: number
}

export interface RotationRequest {
  booking: Booking
  date: string
  /** Time slots to fill, in order. */
  slots: RotationSlot[]
  /** Activities to rotate through. One per group per slot. */
  activityIds: string[]
  /** Groups taking part, in column order. */
  groupIds: string[]
  delivery: Delivery
  activities: Map<string, Activity>
}

/**
 * Builds a rotation so every group does every activity exactly once, and no two
 * groups are ever on the same activity at the same time.
 *
 * This is the Latin square that staff currently build by hand: with N groups,
 * group *g* takes activity `(slot + g) mod N` in each slot. When there are more
 * activities than groups the extra activities simply go unused for that day;
 * when there are fewer, the short groups get an empty slot rather than a clash.
 */
export function buildRotation(request: RotationRequest): Block[] {
  const { booking, date, slots, activityIds, groupIds, delivery, activities } = request
  if (slots.length === 0 || groupIds.length === 0 || activityIds.length === 0) return []

  const blocks: Block[] = []

  slots.forEach((slot, slotIndex) => {
    groupIds.forEach((groupId, groupIndex) => {
      // Offset by group so each column sees a different activity in this slot.
      const activityIndex = (slotIndex + groupIndex) % activityIds.length
      // With more groups than activities, the surplus groups would double up —
      // leave them empty instead of creating a guaranteed clash.
      if (groupIndex >= activityIds.length) return

      const activityId = activityIds[activityIndex]
      const activity = activities.get(activityId)
      if (!activity) return

      // Run for as long as the activity normally takes, or the slot, whichever
      // is shorter — a two-hour hole in the day is not a two-hour session.
      const endMin = Math.min(slot.endMin, slot.startMin + activity.defaultDurationMin)

      blocks.push({
        id: uid('blk'),
        bookingId: booking.id,
        date,
        startMin: slot.startMin,
        endMin,
        groupIds: [groupId],
        kind: 'activity',
        activityId,
        delivery: activity.deliveries.includes(delivery) ? delivery : activity.deliveries[0],
        staffIds: [],
        venueId: activity.venueIds[0],
      })
    })
  })

  return blocks
}

/**
 * Suggests rotation slots from the gaps already left in a day — i.e. the space
 * between the meals and logistics blocks that a day template lays down.
 */
export function suggestSlots(
  existing: Block[],
  options: { dayStart: number; dayEnd: number; minLength?: number; maxLength?: number },
): RotationSlot[] {
  const minLength = options.minLength ?? 45
  const maxLength = options.maxLength ?? 120

  const busy = existing
    .map((b) => [b.startMin, b.endMin] as const)
    .sort((a, b) => a[0] - b[0])

  // Once a day has meals and logistics on it, the programmed day runs from the
  // first block to the last — the empty grid before breakfast and after
  // departure is not somewhere an activity can go.
  const from = busy.length > 0 ? Math.max(options.dayStart, busy[0][0]) : options.dayStart
  const to = busy.length > 0
    ? Math.min(options.dayEnd, Math.max(...busy.map(([, end]) => end)))
    : options.dayEnd

  const slots: RotationSlot[] = []
  let cursor = from

  for (const [start, end] of busy) {
    if (start - cursor >= minLength) {
      slots.push({ startMin: cursor, endMin: Math.min(start, cursor + maxLength) })
    }
    cursor = Math.max(cursor, end)
  }
  if (to - cursor >= minLength) {
    slots.push({ startMin: cursor, endMin: Math.min(to, cursor + maxLength) })
  }

  return slots
}
