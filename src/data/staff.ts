import type { CompetencyEntry, CompetencyLevel, Site, StaffMember } from '@/types'
import { ACTIVITY_NAMES, PACKED_STAFF } from './staff.generated'

const LEVELS: CompetencyLevel[] = [
  'trainer',
  'can_run',
  'can_run_elsewhere',
  'in_training',
  'wants_to_learn',
  'no',
  'unknown',
]

const SITE_IDS: Site[] = ['woodhouse', 'roonka']

/** Expands the index-compressed generated table into the domain shape. */
export const SEED_STAFF: StaffMember[] = PACKED_STAFF.map(([id, name, siteIndexes, entries]) => ({
  id,
  name,
  sites: siteIndexes.map((index) => SITE_IDS[index]),
  competency: entries.map((entry): CompetencyEntry => {
    const [activityIndex, siteIndex, levelIndex, note] = entry
    return {
      activityName: ACTIVITY_NAMES[activityIndex as number],
      site: SITE_IDS[siteIndex as number],
      level: LEVELS[levelIndex as number] ?? 'unknown',
      ...(typeof note === 'string' ? { note } : {}),
    }
  }),
}))

/** Every activity name that appears in the training workbook, for reference. */
export { ACTIVITY_NAMES }
