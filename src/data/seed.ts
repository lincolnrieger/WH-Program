import type { Booking, ProgramDocument } from '@/types'
import { DOCUMENT_VERSION, EMPTY_OVERRIDES } from '@/types'
import { uid } from '@/lib/id'
import { addDays, startOfWeek, toISODate } from '@/lib/time'
import { instantiateTemplate, DAY_TEMPLATES } from './templates'
import { SEED_ACTIVITIES } from './activities'

/**
 * A starter week modelled on the real holistic sheets: several schools on site
 * at once, overlapping stays, different package tiers and group counts.
 *
 * Dated from the Monday of the current week, so it always lands on a week you
 * can actually see rather than somewhere in 2024.
 */
export function createSeedDocument(): ProgramDocument {
  const monday = startOfWeek(toISODate(new Date()))

  const bookings: Booking[] = [
    {
      id: uid('bkg'),
      site: 'woodhouse',
      schoolName: 'Investigator College',
      yearLevel: 'Year 3',
      studentCount: 45,
      packageTier: 'ultimate',
      building: 'Manor',
      startDate: monday,
      endDate: addDays(monday, 1),
      groups: [
        { id: uid('grp'), name: 'Group 1', size: 23 },
        { id: uid('grp'), name: 'Group 2', size: 22 },
      ],
    },
    {
      id: uid('bkg'),
      site: 'woodhouse',
      schoolName: 'Allenby Gardens Primary School',
      yearLevel: 'Year 4',
      studentCount: 55,
      packageTier: 'ultimate',
      building: 'Manor',
      startDate: addDays(monday, 1),
      endDate: addDays(monday, 2),
      groups: [
        { id: uid('grp'), name: 'Group 1', size: 28 },
        { id: uid('grp'), name: 'Group 2', size: 27 },
      ],
    },
    {
      id: uid('bkg'),
      site: 'woodhouse',
      schoolName: 'Pulteney Grammar School',
      yearLevel: 'Year 4',
      studentCount: 60,
      packageTier: 'ultimate',
      building: 'Rymill',
      startDate: addDays(monday, 2),
      endDate: addDays(monday, 4),
      groups: [
        { id: uid('grp'), name: 'Group 1', size: 30 },
        { id: uid('grp'), name: 'Group 2', size: 30 },
      ],
    },
  ]

  const blocks = bookings.flatMap((booking) => {
    const [arrival, full, departure] = [DAY_TEMPLATES[0], DAY_TEMPLATES[1], DAY_TEMPLATES[2]]
    const dates: string[] = []
    for (let d = booking.startDate; d <= booking.endDate; d = addDays(d, 1)) dates.push(d)

    return dates.flatMap((date, index) => {
      const template = index === 0 ? arrival : index === dates.length - 1 ? departure : full
      return instantiateTemplate(template, booking, date)
    })
  })

  // Give the first booking a filled-in first afternoon so the app opens on
  // something that looks like a real plan rather than an empty grid.
  const first = bookings[0]
  const labyrinth = SEED_ACTIVITIES.find((a) => a.id === 'labyrinth')!
  const laser = SEED_ACTIVITIES.find((a) => a.id === 'laser-skirmish')!
  const tube = SEED_ACTIVITIES.find((a) => a.id === 'tube-slide')!

  const afternoon = [
    { activity: labyrinth, start: 11 * 60, group: 0 },
    { activity: laser, start: 11 * 60, group: 1 },
    { activity: tube, start: 13 * 60 + 30, group: 0 },
    { activity: labyrinth, start: 13 * 60 + 30, group: 1 },
    { activity: laser, start: 15 * 60 + 30, group: 0 },
    { activity: tube, start: 15 * 60 + 30, group: 1 },
  ].map(({ activity, start, group }) => ({
    id: uid('blk'),
    bookingId: first.id,
    date: first.startDate,
    startMin: start,
    endMin: start + 90,
    groupIds: [first.groups[group].id],
    kind: 'activity' as const,
    activityId: activity.id,
    delivery: 'staff' as const,
    venueId: activity.venueIds[0],
  }))

  return {
    version: DOCUMENT_VERSION,
    site: 'woodhouse',
    bookings,
    blocks: [...blocks, ...afternoon],
    customActivities: [],
    customVenues: [],
    customStaff: [],
    overrides: structuredClone(EMPTY_OVERRIDES),
    updatedAt: new Date().toISOString(),
  }
}
