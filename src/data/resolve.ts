import type {
  Activity, CompetencyEntry, CompetencyLevel, Overrides, ProgramDocument,
  Site, StaffMember, Venue,
} from '@/types'
import { EMPTY_OVERRIDES } from '@/types'
import { SEED_ACTIVITIES } from './activities'
import { SEED_VENUES } from './venues'
import { SEED_STAFF } from './staff'

/**
 * Resolves the seed catalogues against the edits saved in a document.
 *
 * Everything in the app reads its activities, venues and staff through here, so
 * a record edited on the Activities or Staff page behaves identically to one
 * that came from the source workbook.
 */

export function overridesOf(doc: ProgramDocument): Overrides {
  return doc.overrides ?? EMPTY_OVERRIDES
}

export function resolveActivities(doc: ProgramDocument): Activity[] {
  const overrides = overridesOf(doc)
  const hidden = new Set(overrides.hiddenActivityIds)

  const seeded = SEED_ACTIVITIES.filter((activity) => !hidden.has(activity.id)).map(
    (activity) => {
      const patch = overrides.activities[activity.id]
      return patch ? { ...activity, ...patch } : activity
    },
  )

  return [...seeded, ...(doc.customActivities ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

export function resolveActivityMap(doc: ProgramDocument): Map<string, Activity> {
  return new Map(resolveActivities(doc).map((activity) => [activity.id, activity]))
}

export function resolveVenues(doc: ProgramDocument): Venue[] {
  const overrides = overridesOf(doc)
  const hidden = new Set(overrides.hiddenVenueIds)

  const seeded = SEED_VENUES.filter((venue) => !hidden.has(venue.id)).map((venue) => {
    const patch = overrides.venues[venue.id]
    return patch ? { ...venue, ...patch } : venue
  })

  return [...seeded, ...(doc.customVenues ?? [])].sort((a, b) => a.name.localeCompare(b.name))
}

export function resolveVenueMap(doc: ProgramDocument): Map<string, Venue> {
  return new Map(resolveVenues(doc).map((venue) => [venue.id, venue]))
}

export function resolveStaff(doc: ProgramDocument): StaffMember[] {
  const overrides = overridesOf(doc)
  const hidden = new Set(overrides.hiddenStaffIds)

  const seeded = SEED_STAFF.filter((person) => !hidden.has(person.id)).map((person) => {
    const patch = overrides.staff[person.id]
    if (!patch) return person
    return {
      ...person,
      name: patch.name ?? person.name,
      sites: patch.sites ?? person.sites,
    }
  })

  return [...seeded, ...(doc.customStaff ?? [])].sort((a, b) => a.name.localeCompare(b.name))
}

export function resolveStaffMap(doc: ProgramDocument): Map<string, StaffMember> {
  return new Map(resolveStaff(doc).map((person) => [person.id, person]))
}

// ─── competency ─────────────────────────────────────────────────────────────

/** Key for a competency override: one level per person, activity and site. */
export function competencyKey(site: Site, activityId: string): string {
  return `${site}:${activityId}`
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Best to worst — used to pick the strongest sign-off across workbook aliases. */
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
 * The competency a person has for an activity at a site.
 *
 * An edit made on the Staff page wins outright. Otherwise the training workbook
 * is consulted, matching both the activity's name and any `trainingNames`
 * aliases it carries, and taking the strongest sign-off found.
 */
export function competencyFor(
  person: StaffMember,
  activity: Activity,
  site: Site,
  overrides: Overrides,
): { level: CompetencyLevel; note?: string; source: 'edited' | 'workbook' | 'none' } {
  const patch = overrides.staff[person.id]
  const key = competencyKey(site, activity.id)
  const edited = patch?.competency?.[key]
  if (edited) {
    return { level: edited, note: patch?.notes?.[key], source: 'edited' }
  }

  const wanted = new Set([activity.name, ...(activity.trainingNames ?? [])].map(normalise))
  const matches = person.competency.filter(
    (entry) => entry.site === site && wanted.has(normalise(entry.activityName)),
  )
  if (matches.length === 0) return { level: 'unknown', source: 'none' }

  const best = matches.reduce((winner: CompetencyEntry, entry) =>
    LEVEL_RANK.indexOf(entry.level) < LEVEL_RANK.indexOf(winner.level) ? entry : winner,
  )
  return { level: best.level, note: best.note, source: 'workbook' }
}
