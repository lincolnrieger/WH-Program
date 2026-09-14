import type {
  Activity, Block, Booking, CompetencyEntry, CompetencyLevel, Issue, Site, StaffMember, Venue,
} from '@/types'
import { QUALIFIED_LEVELS } from '@/types'
import { formatRange, overlapMinutes, rangesOverlap } from './time'

export interface ConflictContext {
  blocks: Block[]
  bookings: Booking[]
  activities: Map<string, Activity>
  venues: Map<string, Venue>
  staff: Map<string, StaffMember>
}

interface Named {
  block: Block
  activity?: Activity
  booking?: Booking
  label: string
}

function labelFor(block: Block, activity?: Activity): string {
  return block.title?.split('\n')[0] ?? activity?.name ?? 'Untitled'
}

function bookingLabel(booking?: Booking): string {
  return booking?.schoolName ?? 'Unknown school'
}

/**
 * Runs every scheduling rule over the document and returns the issues found.
 *
 * Rules are deliberately ordered from "definitely wrong" (a group in two places
 * at once) through to "worth a look" (a long unscheduled gap), and each issue
 * carries the block ids it implicates so the grid can highlight them.
 */
export function findIssues(ctx: ConflictContext): Issue[] {
  const issues: Issue[] = []
  const bookingById = new Map(ctx.bookings.map((b) => [b.id, b]))

  const enriched: Named[] = ctx.blocks.map((block) => {
    const activity = block.activityId ? ctx.activities.get(block.activityId) : undefined
    const booking = bookingById.get(block.bookingId)
    return { block, activity, booking, label: labelFor(block, activity) }
  })

  // Group blocks by date once; every rule below is scoped to a single day.
  const byDate = new Map<string, Named[]>()
  for (const item of enriched) {
    const list = byDate.get(item.block.date)
    if (list) list.push(item)
    else byDate.set(item.block.date, [item])
  }

  for (const [date, items] of byDate) {
    checkGroupOverlaps(date, items, issues)
    checkVenueClashes(date, items, ctx, issues)
    checkExclusiveActivities(date, items, issues)
    checkIncompatiblePairs(date, items, issues)
    checkStaffDoubleBooking(date, items, ctx, issues)
    checkStaffQualifications(date, items, ctx, issues)
    checkStaffingLevels(date, items, issues)
    checkCapacity(date, items, issues)
    checkTurnaround(date, items, issues)
  }

  checkCoverage(ctx, byDate, issues)

  return issues
}

/** A group cannot be in two places at once. */
function checkGroupOverlaps(date: string, items: Named[], out: Issue[]): void {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]
      const b = items[j]
      if (a.block.bookingId !== b.block.bookingId) continue
      if (!rangesOverlap(a.block.startMin, a.block.endMin, b.block.startMin, b.block.endMin)) continue

      const shared = a.block.groupIds.filter((id) => b.block.groupIds.includes(id))
      if (shared.length === 0) continue

      const names = shared
        .map((id) => a.booking?.groups.find((g) => g.id === id)?.name ?? 'a group')
        .join(', ')

      out.push({
        id: `overlap:${a.block.id}:${b.block.id}`,
        severity: 'error',
        rule: 'group-overlap',
        message: `${names} is booked into “${a.label}” and “${b.label}” at the same time (${formatRange(
          Math.max(a.block.startMin, b.block.startMin),
          Math.min(a.block.endMin, b.block.endMin),
        )}).`,
        blockIds: [a.block.id, b.block.id],
        date,
        bookingId: a.block.bookingId,
      })
    }
  }
}

/** One venue, one group at a time — across every school on site. */
function checkVenueClashes(date: string, items: Named[], ctx: ConflictContext, out: Issue[]): void {
  const withVenue = items.filter((item) => item.block.venueId ?? item.activity?.venueIds.length === 1)

  for (let i = 0; i < withVenue.length; i += 1) {
    for (let j = i + 1; j < withVenue.length; j += 1) {
      const a = withVenue[i]
      const b = withVenue[j]
      const venueA = a.block.venueId ?? a.activity?.venueIds[0]
      const venueB = b.block.venueId ?? b.activity?.venueIds[0]
      if (!venueA || venueA !== venueB) continue
      if (!rangesOverlap(a.block.startMin, a.block.endMin, b.block.startMin, b.block.endMin)) continue
      // The same school running one activity across several groups is fine.
      if (a.block.bookingId === b.block.bookingId && a.block.activityId === b.block.activityId) continue

      const venueName = ctx.venues.get(venueA)?.name ?? venueA
      out.push({
        id: `venue:${a.block.id}:${b.block.id}`,
        severity: 'error',
        rule: 'venue-clash',
        message: `${venueName} is double-booked: “${a.label}” (${bookingLabel(a.booking)}) overlaps “${b.label}” (${bookingLabel(b.booking)}).`,
        blockIds: [a.block.id, b.block.id],
        date,
      })
    }
  }
}

/** Activities with a single set of equipment can only run once at a time. */
function checkExclusiveActivities(date: string, items: Named[], out: Issue[]): void {
  const exclusive = items.filter((item) => item.activity?.exclusive)

  for (let i = 0; i < exclusive.length; i += 1) {
    for (let j = i + 1; j < exclusive.length; j += 1) {
      const a = exclusive[i]
      const b = exclusive[j]
      if (a.block.activityId !== b.block.activityId) continue
      if (!rangesOverlap(a.block.startMin, a.block.endMin, b.block.startMin, b.block.endMin)) continue
      if (a.block.bookingId === b.block.bookingId) continue // same school splitting groups is fine

      out.push({
        id: `exclusive:${a.block.id}:${b.block.id}`,
        severity: 'error',
        rule: 'activity-exclusive',
        message: `${a.label} can only run once at a time — ${bookingLabel(a.booking)} and ${bookingLabel(b.booking)} are both scheduled for it.`,
        blockIds: [a.block.id, b.block.id],
        date,
      })
    }
  }
}

/** "Don't run at the same time as…" rules from the activity notes. */
function checkIncompatiblePairs(date: string, items: Named[], out: Issue[]): void {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]
      const b = items[j]
      if (!a.activity || !b.activity) continue
      if (!rangesOverlap(a.block.startMin, a.block.endMin, b.block.startMin, b.block.endMin)) continue

      const clashes =
        a.activity.conflictsWith.includes(b.activity.id) ||
        b.activity.conflictsWith.includes(a.activity.id)
      if (!clashes) continue

      out.push({
        id: `incompatible:${a.block.id}:${b.block.id}`,
        severity: 'warning',
        rule: 'incompatible-activities',
        message: `${a.activity.name} and ${b.activity.name} are not meant to run at the same time.`,
        blockIds: [a.block.id, b.block.id],
        date,
      })
    }
  }
}

/** A staff member cannot lead two sessions at once. */
function checkStaffDoubleBooking(date: string, items: Named[], ctx: ConflictContext, out: Issue[]): void {
  const staffed = items.filter((item) => item.block.staffIds.length > 0)

  for (let i = 0; i < staffed.length; i += 1) {
    for (let j = i + 1; j < staffed.length; j += 1) {
      const a = staffed[i]
      const b = staffed[j]
      if (!rangesOverlap(a.block.startMin, a.block.endMin, b.block.startMin, b.block.endMin)) continue

      const shared = a.block.staffIds.filter((id) => b.block.staffIds.includes(id))
      if (shared.length === 0) continue

      const names = shared.map((id) => ctx.staff.get(id)?.name ?? id).join(', ')
      out.push({
        id: `staff-clash:${a.block.id}:${b.block.id}`,
        severity: 'error',
        rule: 'staff-double-booked',
        message: `${names} is rostered on “${a.label}” and “${b.label}” at the same time.`,
        blockIds: [a.block.id, b.block.id],
        date,
      })
    }
  }
}

/** Warn when someone is rostered on an activity they aren't signed off for. */
function checkStaffQualifications(date: string, items: Named[], ctx: ConflictContext, out: Issue[]): void {
  for (const item of items) {
    if (!item.activity || item.block.delivery !== 'staff') continue
    const site = item.booking?.site
    if (!site) continue

    for (const staffId of item.block.staffIds) {
      const person = ctx.staff.get(staffId)
      if (!person) continue

      const entry = competencyFor(person, item.activity, site)
      if (entry && QUALIFIED_LEVELS.includes(entry.level)) continue

      const detail = entry
        ? `is marked “${entry.level.replace(/_/g, ' ')}”`
        : 'has no training recorded'
      out.push({
        id: `unqualified:${item.block.id}:${staffId}`,
        severity: 'warning',
        rule: 'staff-not-qualified',
        message: `${person.name} ${detail} for ${item.activity.name}.`,
        blockIds: [item.block.id],
        date,
        bookingId: item.block.bookingId,
      })
    }
  }
}

/** Flag staff-led activities that don't have enough people rostered. */
function checkStaffingLevels(date: string, items: Named[], out: Issue[]): void {
  for (const item of items) {
    const needed = item.activity?.minStaff ?? 0
    if (!item.activity || item.block.delivery !== 'staff' || needed === 0) continue
    const rostered = item.block.staffIds.length
    if (rostered >= needed) continue

    out.push({
      id: `understaffed:${item.block.id}`,
      severity: rostered === 0 ? 'info' : 'warning',
      rule: 'understaffed',
      message:
        rostered === 0
          ? `${item.activity.name} has no staff assigned (needs ${needed}).`
          : `${item.activity.name} has ${rostered} of ${needed} staff assigned.`,
      blockIds: [item.block.id],
      date,
      bookingId: item.block.bookingId,
    })
  }
}

/** Compare group sizes against the activity cap. */
function checkCapacity(date: string, items: Named[], out: Issue[]): void {
  for (const item of items) {
    const activity = item.activity
    const cap = activity?.capacity
    if (!activity || !cap || !item.booking) continue

    const heads = item.block.groupIds.reduce((total, groupId) => {
      const group = item.booking!.groups.find((g) => g.id === groupId)
      return total + (group?.size ?? 0)
    }, 0)
    if (heads === 0 || heads <= cap) continue

    out.push({
      id: `capacity:${item.block.id}`,
      severity: 'warning',
      rule: 'over-capacity',
      message: `${activity.name} is capped at ${cap} students — ${heads} are scheduled.`,
      blockIds: [item.block.id],
      date,
      bookingId: item.block.bookingId,
    })
  }
}

/**
 * Back-to-back sessions in the same venue need enough time for the first to be
 * packed down and the second set up.
 */
function checkTurnaround(date: string, items: Named[], out: Issue[]): void {
  const sorted = [...items]
    .filter((item) => item.activity)
    .sort((a, b) => a.block.startMin - b.block.startMin)

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const first = sorted[i]
      const second = sorted[j]
      const venueA = first.block.venueId ?? first.activity?.venueIds[0]
      const venueB = second.block.venueId ?? second.activity?.venueIds[0]
      if (!venueA || venueA !== venueB) continue
      if (second.block.startMin < first.block.endMin) continue // handled as a clash

      const gap = second.block.startMin - first.block.endMin
      const needed = (first.activity?.packdownMin ?? 0) + (second.activity?.setupMin ?? 0)
      if (needed === 0 || gap >= needed) continue

      out.push({
        id: `turnaround:${first.block.id}:${second.block.id}`,
        severity: 'warning',
        rule: 'tight-turnaround',
        message: `Only ${gap} min between “${first.label}” and “${second.label}” — pack-down plus set-up needs ${needed} min.`,
        blockIds: [first.block.id, second.block.id],
        date,
      })
      break // one warning per leading block is enough
    }
  }
}

/** Surface groups sitting with a long unscheduled hole in the middle of the day. */
function checkCoverage(ctx: ConflictContext, byDate: Map<string, Named[]>, out: Issue[]): void {
  const GAP_THRESHOLD = 60

  for (const booking of ctx.bookings) {
    for (const [date, items] of byDate) {
      const forBooking = items.filter((item) => item.block.bookingId === booking.id)
      if (forBooking.length === 0) continue

      const dayStart = Math.min(...forBooking.map((i) => i.block.startMin))
      const dayEnd = Math.max(...forBooking.map((i) => i.block.endMin))

      for (const group of booking.groups) {
        const spans = forBooking
          .filter((item) => item.block.groupIds.includes(group.id))
          .map((item) => [item.block.startMin, item.block.endMin] as const)
          .sort((a, b) => a[0] - b[0])

        let cursor = dayStart
        for (const [start, end] of spans) {
          if (start - cursor >= GAP_THRESHOLD) {
            out.push({
              id: `gap:${booking.id}:${group.id}:${date}:${cursor}`,
              severity: 'info',
              rule: 'unscheduled-gap',
              message: `${group.name} has nothing scheduled ${formatRange(cursor, start)}.`,
              blockIds: [],
              date,
              bookingId: booking.id,
            })
          }
          cursor = Math.max(cursor, end)
        }
        if (dayEnd - cursor >= GAP_THRESHOLD) {
          out.push({
            id: `gap:${booking.id}:${group.id}:${date}:${cursor}`,
            severity: 'info',
            rule: 'unscheduled-gap',
            message: `${group.name} has nothing scheduled ${formatRange(cursor, dayEnd)}.`,
            blockIds: [],
            date,
            bookingId: booking.id,
          })
        }
      }
    }
  }
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Finds a person's sign-off for an activity at a site.
 *
 * The training workbook and the activity catalogue don't use identical wording —
 * "Laser Skirmish LIC" and "Laser Skirmish 2nd" are both sign-offs for the one
 * scheduled Laser Skirmish, and several activities are written with a suffix
 * ("Orienteering (45min)"). `trainingNames` carries those aliases, and the best
 * (highest) level found across them wins.
 */
function competencyFor(
  person: StaffMember,
  activity: Activity,
  site: Site,
): CompetencyEntry | undefined {
  const wanted = new Set(
    [activity.name, ...(activity.trainingNames ?? [])].map(normalise),
  )
  const matches = person.competency.filter(
    (entry) => entry.site === site && wanted.has(normalise(entry.activityName)),
  )
  if (matches.length === 0) return undefined
  return matches.reduce((best, entry) =>
    LEVEL_RANK.indexOf(entry.level) < LEVEL_RANK.indexOf(best.level) ? entry : best,
  )
}

/** Best to worst — used to pick the strongest sign-off across aliases. */
const LEVEL_RANK: CompetencyLevel[] = [
  'trainer',
  'can_run',
  'can_run_elsewhere',
  'in_training',
  'wants_to_learn',
  'unknown',
  'no',
]

/**
 * Staff who are free for a block and signed off on its activity.
 * Drives the "who can run this?" picker in the inspector.
 */
export function availableStaff(
  block: Block,
  ctx: ConflictContext,
  site: Site,
): { person: StaffMember; qualified: boolean; busy: boolean }[] {
  const activity = block.activityId ? ctx.activities.get(block.activityId) : undefined

  const busyIds = new Set<string>()
  for (const other of ctx.blocks) {
    if (other.id === block.id || other.date !== block.date) continue
    if (!rangesOverlap(block.startMin, block.endMin, other.startMin, other.endMin)) continue
    for (const id of other.staffIds) busyIds.add(id)
  }

  return [...ctx.staff.values()]
    .filter((person) => person.sites.includes(site))
    .map((person) => {
      const entry = activity ? competencyFor(person, activity, site) : undefined
      return {
        person,
        qualified: entry ? QUALIFIED_LEVELS.includes(entry.level) : false,
        busy: busyIds.has(person.id),
      }
    })
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1
      if (a.busy !== b.busy) return a.busy ? 1 : -1
      return a.person.name.localeCompare(b.person.name)
    })
}

export { overlapMinutes }
