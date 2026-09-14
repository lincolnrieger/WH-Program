import type { Block, Booking, BlockKind } from '@/types'
import { uid } from '@/lib/id'
import { ROUTINES } from './activities'

export interface DayTemplateEntry {
  routineId: string
  startMin: number
  /** Overrides the routine's default length. */
  durationMin?: number
  /** Overrides the routine's default title. */
  title?: string
}

export interface DayTemplate {
  id: string
  name: string
  description: string
  entries: DayTemplateEntry[]
}

const t = (h: number, m = 0) => h * 60 + m

/**
 * The three day shapes every camp itinerary is built from, with the standard
 * times used across the existing holistic sheets. Applying one lays down the
 * meals and logistics so only the activity slots are left to fill.
 */
export const DAY_TEMPLATES: DayTemplate[] = [
  {
    id: 'arrival-day',
    name: 'Arrival day',
    description: 'Mid-morning arrival, two activity slots, dorms and evening program.',
    entries: [
      { routineId: 'arrival', startMin: t(10, 30), durationMin: 30, title: 'Arrive / Unload bags\nWelcome Talk / Morning Tea' },
      { routineId: 'lunch', startMin: t(12, 30), durationMin: 60 },
      { routineId: 'afternoon-tea', startMin: t(15), durationMin: 30, title: 'Afternoon Tea\nBuilding check in from 2pm' },
      { routineId: 'bags-to-dorms', startMin: t(17), durationMin: 30 },
      { routineId: 'dinner', startMin: t(17, 30), durationMin: 120 },
      { routineId: 'evening-activities', startMin: t(19, 30), durationMin: 90 },
    ],
  },
  {
    id: 'full-day',
    name: 'Full day',
    description: 'Breakfast through evening program — four activity slots.',
    entries: [
      { routineId: 'breakfast', startMin: t(7, 30), durationMin: 90 },
      { routineId: 'morning-tea', startMin: t(10, 30), durationMin: 30 },
      { routineId: 'lunch', startMin: t(12, 30), durationMin: 60 },
      { routineId: 'afternoon-tea', startMin: t(15), durationMin: 30 },
      { routineId: 'free-time', startMin: t(17), durationMin: 30 },
      { routineId: 'dinner', startMin: t(17, 30), durationMin: 120 },
      { routineId: 'evening-activities', startMin: t(19, 30), durationMin: 90 },
    ],
  },
  {
    id: 'departure-day',
    name: 'Departure day',
    description: 'Pack up, two morning slots, lunch and departure.',
    entries: [
      { routineId: 'breakfast', startMin: t(7, 30), durationMin: 90, title: 'Breakfast\nPack bags, clean building, move bags to store' },
      { routineId: 'morning-tea', startMin: t(10, 30), durationMin: 30 },
      { routineId: 'lunch', startMin: t(12, 30), durationMin: 60 },
      { routineId: 'departure', startMin: t(13, 30), durationMin: 30 },
    ],
  },
  {
    id: 'day-visit',
    name: 'Day visit',
    description: 'Arrive mid-morning, recess, lunch, depart mid-afternoon.',
    entries: [
      { routineId: 'arrival', startMin: t(9, 30), durationMin: 30, title: 'Arrival' },
      { routineId: 'recess', startMin: t(10, 45), durationMin: 15 },
      { routineId: 'lunch', startMin: t(12), durationMin: 30 },
      { routineId: 'prepare-departure', startMin: t(14, 15), durationMin: 15 },
    ],
  },
]

/** Turns a template into concrete blocks for one booking on one date. */
export function instantiateTemplate(
  template: DayTemplate,
  booking: Booking,
  date: string,
): Block[] {
  const allGroupIds = booking.groups.map((g) => g.id)

  return template.entries.flatMap((entry) => {
    const routine = ROUTINES.find((r) => r.id === entry.routineId)
    if (!routine) return []

    const duration = entry.durationMin ?? routine.durationMin
    const kind: BlockKind = routine.kind

    return [{
      id: uid('blk'),
      bookingId: booking.id,
      date,
      startMin: entry.startMin,
      endMin: entry.startMin + duration,
      groupIds: routine.wholeSchool ? allGroupIds : [allGroupIds[0]],
      kind,
      title: entry.title ?? routine.title,
      delivery: 'staff' as const,
      staffIds: [],
      colour: routine.colour,
    }]
  })
}

/** Package tiers seen on the booking header lines of the holistic sheets. */
export const PACKAGE_PRESETS = [
  { id: 'bronze', label: 'Bronze', activitiesPerDay: 1 },
  { id: 'silver', label: 'Silver', activitiesPerDay: 2 },
  { id: 'gold', label: 'Gold', activitiesPerDay: 3 },
  { id: 'ultimate', label: 'Ultimate', activitiesPerDay: 4 },
] as const
