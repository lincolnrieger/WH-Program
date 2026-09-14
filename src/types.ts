/**
 * Domain model for the Woodhouse Program Builder.
 *
 * Times are stored as **minutes from midnight** (e.g. 9:30am === 570). Dates are
 * stored as ISO calendar dates (`YYYY-MM-DD`) with no timezone attached — a camp
 * day is a local calendar day, never an instant.
 */

export type Site = 'woodhouse' | 'roonka'

export const SITES: { id: Site; name: string; short: string }[] = [
  { id: 'woodhouse', name: 'Woodhouse Adventure Park', short: 'Woodhouse' },
  { id: 'roonka', name: 'Roonka', short: 'Roonka' },
]

/** How an activity gets delivered — drives staffing requirements. */
export type Delivery = 'staff' | 'teacher_led' | 'self_led'

export const DELIVERY_LABELS: Record<Delivery, string> = {
  staff: 'Staff led',
  teacher_led: 'Teacher led',
  self_led: 'Self led',
}

/** Suffix shown on the block title, matching the existing spreadsheet convention. */
export const DELIVERY_SUFFIX: Record<Delivery, string> = {
  staff: '',
  teacher_led: ' - TL',
  self_led: ' - Self Led',
}

export type ActivityCategory =
  | 'adventure'
  | 'water'
  | 'nature'
  | 'teamwork'
  | 'craft'
  | 'navigation'
  | 'camping'
  | 'games'

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  adventure: 'Adventure',
  water: 'Water',
  nature: 'Nature & Ecology',
  teamwork: 'Teamwork',
  craft: 'Craft',
  navigation: 'Navigation',
  camping: 'Camping & Cooking',
  games: 'Games',
}

export interface Activity {
  id: string
  name: string
  /** Sites this activity can run at. */
  sites: Site[]
  category: ActivityCategory
  /** Hex colour carried over from the existing "Activities Colour Key" sheets. */
  colour: string
  /** Typical run time in minutes, used as the default block length. */
  defaultDurationMin: number
  /** Minutes of staff set-up before the session starts. */
  setupMin: number
  /** Minutes of pack-down after the session ends. */
  packdownMin: number
  /** Venue ids this activity can run at. Empty = no fixed venue. */
  venueIds: string[]
  /** Max students in one session, if the activity is capped. */
  capacity?: number
  /** Staff needed when run by staff (0 for activities that are always teacher led). */
  minStaff: number
  /** Only one group on site can be doing this at a time (single set of equipment). */
  exclusive?: boolean
  /** Activity ids that must not run at the same time as this one. */
  conflictsWith: string[]
  /** Free-text scheduling guidance from the activity notes sheet. */
  notes?: string
  /** Deliveries this activity is normally offered as. */
  deliveries: Delivery[]
  /**
   * Names this activity goes by in the staff-training workbook, where several
   * sign-offs (e.g. "Laser Skirmish LIC" and "Laser Skirmish 2nd") map onto one
   * scheduled activity. Used when matching staff competency.
   */
  trainingNames?: string[]
}

export interface Venue {
  id: string
  name: string
  sites: Site[]
  /** Max students the space holds at once. */
  capacity?: number
}

export type CompetencyLevel =
  | 'trainer'
  | 'can_run'
  | 'can_run_elsewhere'
  | 'in_training'
  | 'wants_to_learn'
  | 'no'
  | 'unknown'

export const COMPETENCY_LABELS: Record<CompetencyLevel, string> = {
  trainer: 'Can train others',
  can_run: 'Can run it',
  can_run_elsewhere: 'Can run at Woodhouse, not yet here',
  in_training: 'Some training',
  wants_to_learn: 'Wants to learn',
  no: 'Does not want to learn',
  unknown: 'Unknown',
}

export const COMPETENCY_COLOURS: Record<CompetencyLevel, string> = {
  trainer: '#00b050',
  can_run: '#92d050',
  can_run_elsewhere: '#8faadc',
  in_training: '#ffd633',
  wants_to_learn: '#ffc000',
  no: '#ff4d4d',
  unknown: '#c9c9c9',
}

/** Levels considered qualified to run a session unsupervised. */
export const QUALIFIED_LEVELS: CompetencyLevel[] = ['trainer', 'can_run']

export interface CompetencyEntry {
  /** Activity name as written in the training workbook (may not match an Activity id). */
  activityName: string
  site: Site
  level: CompetencyLevel
  note?: string
}

export interface StaffMember {
  id: string
  name: string
  sites: Site[]
  competency: CompetencyEntry[]
}

/** A group of students that rotates through activities together. */
export interface Group {
  id: string
  name: string
  size?: number
  /** Optional colour override for the group column header. */
  colour?: string
}

export type PackageTier = 'bronze' | 'silver' | 'gold' | 'ultimate' | 'custom'

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  ultimate: 'Ultimate',
  custom: 'Custom',
}

/** A school's stay on site: the thing an itinerary is built for. */
export interface Booking {
  id: string
  site: Site
  schoolName: string
  yearLevel: string
  /** Estimated student numbers. */
  studentCount?: number
  packageTier: PackageTier
  /** Accommodation, e.g. "Manor", "Rymill", "Gilwell Basecamp". */
  building: string
  /** Inclusive ISO date range of the stay. */
  startDate: string
  endDate: string
  groups: Group[]
  notes?: string
  /** Contact/organising teacher. */
  contact?: string
}

export type BlockKind = 'activity' | 'meal' | 'logistics' | 'custom'

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  activity: 'Activity',
  meal: 'Meal / Break',
  logistics: 'Logistics',
  custom: 'Custom',
}

/** A scheduled item on the grid. */
export interface Block {
  id: string
  bookingId: string
  /** ISO calendar date (YYYY-MM-DD). */
  date: string
  /** Minutes from midnight. */
  startMin: number
  endMin: number
  /** Groups this block applies to. Multiple groups render as one spanning block. */
  groupIds: string[]
  kind: BlockKind
  /** Set for kind === 'activity'. */
  activityId?: string
  /** Overrides the activity name (or supplies the name for non-activity blocks). */
  title?: string
  delivery: Delivery
  staffIds: string[]
  venueId?: string
  note?: string
  /** Locked blocks cannot be moved or resized by dragging. */
  locked?: boolean
  /** Colour override; falls back to the activity colour or a kind default. */
  colour?: string
}

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  severity: IssueSeverity
  /** Machine-readable rule that produced this issue. */
  rule: string
  message: string
  /** Blocks the issue points at — used to highlight them on the grid. */
  blockIds: string[]
  date: string
  bookingId?: string
}

/** Everything the app persists. */
export interface ProgramDocument {
  version: number
  /** Free-text label, e.g. "Term 4 — Week 10". */
  name: string
  site: Site
  bookings: Booking[]
  blocks: Block[]
  /** User-added activities, merged over the seed catalogue. */
  customActivities: Activity[]
  updatedAt: string
}

export const DOCUMENT_VERSION = 3
