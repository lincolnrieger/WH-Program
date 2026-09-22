import type { Activity, Delivery } from '@/types'

/**
 * Activity catalogue.
 *
 * Colours are the exact cell fills from the "Activities Colour Key" sheet, so a
 * printed or exported plan reads the way staff are already used to. Where that
 * sheet used an Excel theme colour rather than a literal RGB one, the theme has
 * been resolved to its hex value (Office theme, e.g. accent2 `#ed7d31` for
 * Laser Skirmish, accent6 `#70ad47` for Team Challenges).
 *
 * Every colour here is a default: editing one on the Activities page stores an
 * override in the database and that is what the app and its exports use from
 * then on.
 */
export const SEED_ACTIVITIES: Activity[] = [
  // ─── Woodhouse ────────────────────────────────────────────────────────────
  {
    id: 'adventurers-trail', name: "Adventurer's Trail", sites: ['woodhouse'],
    colour: '#00b050', defaultDurationMin: 90,
    venueIds: ['adventurers-trail'],
    deliveries: ['staff', 'teacher_led'],
    trainingNames: ['Adventures Trail'],
  },
  {
    id: 'junior-adventurers-trail', name: "Junior Adventurer's Trail", sites: ['woodhouse'],
    colour: '#33c477', defaultDurationMin: 90,
    venueIds: ['adventurers-trail'],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'bouldering', name: 'Bouldering', sites: ['woodhouse'],
    colour: '#ffc000', defaultDurationMin: 90,
    venueIds: ['bouldering-wall'],
    deliveries: ['staff', 'self_led'],
  },
  {
    id: 'bridge-building', name: 'Bridge Building', sites: ['woodhouse'],
    colour: '#ba5d38', defaultDurationMin: 90,
    venueIds: ['seeonee-lones-field'],
    deliveries: ['staff'],
    notes: 'Shares the pioneering gear with Pioneering Construction.',
  },
  {
    id: 'bug-busters', name: 'Bug Busters', sites: ['woodhouse'],
    colour: '#0400ff', defaultDurationMin: 90,
    venueIds: ['wetland', 'enviro-room'],
    deliveries: ['staff'],
    notes: 'Better before students do water activities.',
  },
  {
    id: 'campcraft', name: 'Campcraft', sites: ['woodhouse', 'roonka'],
    colour: '#9e2d00', defaultDurationMin: 90,
    venueIds: ['bunk-pit'],
    deliveries: ['staff'],
  },
  {
    id: 'campsite-setup', name: 'Campsite Setup', sites: ['woodhouse'],
    colour: '#a7ffe0', defaultDurationMin: 90,
    venueIds: [],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'campsite-packup', name: 'Campsite Pack Up', sites: ['woodhouse'],
    colour: '#00ee99', defaultDurationMin: 60,
    venueIds: [],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'catapult-construction', name: 'Catapult Construction', sites: ['woodhouse'],
    colour: '#a0522d', defaultDurationMin: 90,
    venueIds: ['seeonee-lones-field'],
    deliveries: ['staff'],
  },
  {
    id: 'challenge-hill', name: 'Challenge Hill', sites: ['woodhouse'],
    colour: '#ff3399', defaultDurationMin: 90,
    venueIds: ['challenge-hill'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'challenge-hill-1', name: 'Challenge Hill Part 1', sites: ['woodhouse'],
    colour: '#ff3399', defaultDurationMin: 90,
    venueIds: ['challenge-hill'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'challenge-hill-2', name: 'Challenge Hill Part 2', sites: ['woodhouse'],
    colour: '#ff3399', defaultDurationMin: 90,
    venueIds: ['challenge-hill'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'camerons-climb', name: "Cameron's Climb", sites: ['woodhouse'],
    colour: '#ffc000', defaultDurationMin: 75,
    venueIds: ['camerons-climb'],
    deliveries: ['teacher_led', 'staff'],
  },
  {
    id: 'compass-navigation', name: 'Compass Navigation', sites: ['woodhouse'],
    colour: '#aeaaaa', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff'],
  },
  {
    id: 'cox-creek-ecology', name: 'Cox Creek Ecology', sites: ['woodhouse'],
    colour: '#2f9e9b', defaultDurationMin: 90,
    venueIds: ['cox-creek'],
    deliveries: ['staff'],
  },
  {
    id: 'disc-golf', name: 'Disc Golf', sites: ['woodhouse'],
    colour: '#ff99ff', defaultDurationMin: 60,
    venueIds: ['disc-golf-course'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'geocaching', name: 'Geocaching', sites: ['woodhouse', 'roonka'],
    colour: '#9999ff', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff', 'teacher_led'],
    trainingNames: ['Geocaching (Junior)', 'Geocaching (Senior)'],
  },
  {
    id: 'ice-blocking', name: 'Ice Blocking', sites: ['woodhouse'],
    colour: '#4472c4', defaultDurationMin: 60,
    venueIds: ['ice-blocking-field'],
    deliveries: ['staff'],
  },
  {
    id: 'labyrinth', name: 'The Labyrinth', sites: ['woodhouse'],
    colour: '#cc00ff', defaultDurationMin: 90,
    venueIds: ['labyrinth'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
    trainingNames: ['Labyrinth'],
  },
  {
    id: 'laser-skirmish', name: 'Laser Skirmish', sites: ['woodhouse'],
    colour: '#ed7d31', defaultDurationMin: 90,
    venueIds: ['laser-field'],
    deliveries: ['staff'],
    trainingNames: ['Laser Skirmish LIC', 'Laser Skirmish 2nd'],
  },
  {
    id: 'lightweight-cooking', name: 'Lightweight Cooking', sites: ['woodhouse', 'roonka'],
    colour: '#0099ff', defaultDurationMin: 120,
    venueIds: ['bunk-pit'],
    deliveries: ['staff'],
    notes: "Don't run before a water activity — students don't have enough time to change.",
    trainingNames: ['LW Cooking'],
  },
  {
    id: 'mandala-art', name: 'Mandala Art', sites: ['woodhouse', 'roonka'],
    colour: '#570099', defaultDurationMin: 90,
    venueIds: ['craft-room'],
    deliveries: ['staff'],
  },
  {
    id: 'nature-handicraft', name: 'Nature Handicraft', sites: ['woodhouse'],
    colour: '#ffe699', defaultDurationMin: 90,
    venueIds: ['craft-room'],
    deliveries: ['staff'],
  },
  {
    id: 'nature-craft', name: 'Nature Craft', sites: ['woodhouse'],
    colour: '#92d050', defaultDurationMin: 90,
    venueIds: ['craft-room'],
    deliveries: ['staff'],
  },
  {
    id: 'orienteering', name: 'Orienteering', sites: ['woodhouse', 'roonka'],
    colour: '#ff0000', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff', 'teacher_led'],
    notes: '45 min or 1.5 hr activity (1.5 hr for seniors).',
    trainingNames: ['Orienteering (45min)', 'Orienteering (1.5hrs)'],
  },
  {
    id: 'photo-hunt', name: 'Photo Hunt', sites: ['woodhouse', 'roonka'],
    colour: '#ff7a7a', defaultDurationMin: 45,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
    notes: '45 min activity.',
  },
  {
    id: 'pioneering-construction', name: 'Pioneering Construction', sites: ['woodhouse'],
    colour: '#d1957d', defaultDurationMin: 90,
    venueIds: ['seeonee-lones-field'],
    deliveries: ['staff'],
  },
  {
    id: 'scats-tracks', name: 'Scats & Tracks', sites: ['woodhouse'],
    colour: '#154d05', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff'],
    trainingNames: ['Scats and Tracks'],
  },
  {
    id: 'survivor', name: 'Survivor', sites: ['woodhouse', 'roonka'],
    colour: '#ffff00', defaultDurationMin: 90,
    venueIds: ['survivor-shed'],
    deliveries: ['staff'],
  },
  {
    id: 'survival-challenge', name: 'Survival Challenge', sites: ['woodhouse'],
    colour: '#ffff00', defaultDurationMin: 90,
    venueIds: ['survivor-shed'],
    deliveries: ['staff'],
    trainingNames: ['Survival Challenge'],
  },
  {
    id: 'team-challenges', name: 'Team Challenges', sites: ['woodhouse', 'roonka'],
    colour: '#70ad47', defaultDurationMin: 90,
    venueIds: ['oval'],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'tube-slide', name: 'Tube Slide', sites: ['woodhouse'],
    colour: '#66ccff', defaultDurationMin: 90,
    venueIds: ['tube-slide'],
    deliveries: ['staff'],
    trainingNames: ['Tube Slide LIC'],
  },
  {
    id: 'tenting-setup', name: 'Tenting Adventure (Setup)', sites: ['woodhouse', 'roonka'],
    colour: '#8fbc8f', defaultDurationMin: 90,
    venueIds: [],
    deliveries: ['staff'],
  },
  {
    id: 'tenting-packdown', name: 'Tenting Adventure (Pack Down)', sites: ['woodhouse', 'roonka'],
    colour: '#6b8e6b', defaultDurationMin: 60,
    venueIds: [],
    deliveries: ['staff'],
  },
  {
    id: 'shelter-building', name: 'Shelter Building', sites: ['woodhouse'],
    colour: '#7c7c7c', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff'],
  },
  {
    id: 'woodhouse-explorers', name: 'Woodhouse Explorers', sites: ['woodhouse'],
    colour: '#ffd966', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff'],
  },
  {
    id: 'ponding-adventure', name: 'Ponding Adventure', sites: ['woodhouse'],
    colour: '#706dff', defaultDurationMin: 90,
    venueIds: ['wetland'],
    deliveries: ['staff'],
  },
  {
    id: 'wide-games', name: 'Wide Games', sites: ['woodhouse'],
    colour: '#f5b68b', defaultDurationMin: 90,
    venueIds: ['woodhouse-property'],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'nature-art', name: 'Nature Art', sites: ['woodhouse'],
    colour: '#ff0000', defaultDurationMin: 90,
    venueIds: ['craft-room'],
    deliveries: ['staff'],
  },
  {
    id: 'journaling', name: 'Journaling', sites: ['woodhouse'],
    colour: '#b0a08c', defaultDurationMin: 60,
    venueIds: [],
    deliveries: ['teacher_led'],
  },
  {
    id: 'contingency', name: 'Contingency Activity', sites: ['woodhouse', 'roonka'],
    colour: '#9aa5b1', defaultDurationMin: 90,
    venueIds: [],
    deliveries: ['staff', 'teacher_led'],
    notes: 'Wet-weather / fallback option.',
    trainingNames: ['Contingency Activities'],
  },

  // ─── Roonka ───────────────────────────────────────────────────────────────
  {
    id: 'boomerang-craft', name: 'Boomerang Craft', sites: ['roonka'],
    colour: '#9000ff', defaultDurationMin: 90,
    venueIds: ['roonka-craft-room'],
    deliveries: ['staff'],
  },
  {
    id: 'bouldering-gaga', name: 'Bouldering + Gaga Ball', sites: ['roonka'],
    colour: '#c86400', defaultDurationMin: 90,
    venueIds: ['roonka-bouldering'],
    deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'campfire-cooking', name: 'Campfire Cooking', sites: ['roonka'],
    colour: '#ffcc99', defaultDurationMin: 120,
    venueIds: ['campfire-circle'],
    deliveries: ['staff'],
    notes: 'Works best straight after Campcraft — the fire has been going longer.',
  },
  {
    id: 'echidna-trail', name: 'Echidna Trail & Nature Scavenger Hunt', sites: ['roonka'],
    colour: '#e8e85a', defaultDurationMin: 90,
    venueIds: ['echidna-trail'],
    deliveries: ['staff', 'teacher_led'],
    trainingNames: ['Nature scavenger hunt and Echidna trail'],
  },
  {
    id: 'fishing-yabbying', name: 'Fishing, Yabbying & Shrimp Catching', sites: ['roonka'],
    colour: '#ccff99', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
    notes: 'Better before students do water activities.',
    trainingNames: ['Fishing, Yabbying and Shrimp Catching'],
  },
  {
    id: 'fur-feathers-feed', name: 'Fur, Feathers and Feed', sites: ['roonka'],
    colour: '#d9b3a1', defaultDurationMin: 60,
    venueIds: ['animal-yards'],
    deliveries: ['staff'],
  },
  {
    id: 'gaga-ball', name: 'Gaga Ball', sites: ['roonka'],
    colour: '#ffb347', defaultDurationMin: 45,
    venueIds: ['roonka-bouldering'],
    deliveries: ['teacher_led', 'self_led'],
  },
  {
    id: 'intro-kayaking', name: 'Intro to Kayaking', sites: ['roonka'],
    colour: '#9dc3e6', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
  },
  {
    id: 'kayaking-adventure', name: 'Kayaking Adventure', sites: ['roonka'],
    colour: '#2e75b6', defaultDurationMin: 120,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
  },
  {
    id: 'paddling-junior', name: 'Paddling (Junior)', sites: ['roonka'],
    colour: '#76b5e0', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
  },
  {
    id: 'paddling-senior', name: 'Paddling (Senior)', sites: ['roonka'],
    colour: '#1f6fb2', defaultDurationMin: 120,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
    trainingNames: ['Paddling (Expo)'],
  },
  {
    id: 'low-ropes', name: 'Low Ropes', sites: ['roonka'],
    colour: '#c00000', defaultDurationMin: 90,
    venueIds: ['low-ropes-course'],
    deliveries: ['staff'],
    notes: 'Long set-up — allow 40 minutes before the session starts.',
  },
  {
    id: 'raft-building', name: 'Raft Building', sites: ['roonka'],
    colour: '#66ccff', defaultDurationMin: 90,
    venueIds: ['raft-bay'],
    deliveries: ['staff'],
    trainingNames: ['Raft Building (junior)', 'Raft Building (senior)'],
  },
  {
    id: 'river-murray-ecology', name: 'River Murray Ecology', sites: ['roonka'],
    colour: '#4a90a4', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
  },
  {
    id: 'water-adventures', name: 'Water Adventures', sites: ['roonka'],
    colour: '#ad5bff', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
    notes: 'Avoid on the last day. Groups can be combined (up to whole school).',
    trainingNames: ['Water Adventurers'],
  },
  {
    id: 'web-of-life', name: 'Web of Life', sites: ['roonka'],
    colour: '#666699', defaultDurationMin: 90,
    venueIds: ['echidna-trail'],
    deliveries: ['staff'],
  },
  {
    id: 'wet-and-wild', name: 'Wet and Wild', sites: ['roonka'],
    colour: '#ff99ff', defaultDurationMin: 90,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
    notes: 'Avoid on the last day. Groups can be combined.',
  },
  {
    id: 'wet-wild-relay', name: 'Wet and Wild Relay', sites: ['roonka'],
    colour: '#ff77e0', defaultDurationMin: 60,
    venueIds: ['river-frontage'],
    deliveries: ['staff'],
  },
]

/**
 * Non-activity blocks that make up the shape of a camp day. These appear in the
 * palette alongside activities so a whole day can be built without typing.
 *
 * The itinerary sheets leave meals and logistics unfilled, so these colours are
 * deliberately neutral — enough to tell the rows apart on screen, and dropped
 * entirely on export so the sheet looks like the one it replaces.
 */
export interface RoutineTemplate {
  id: string
  title: string
  kind: 'meal' | 'logistics'
  durationMin: number
  colour: string
  /** Applies to every group by default. */
  wholeSchool: boolean
  /**
   * Defaults to staff led. Set where the printed line carries a suffix — the
   * evening program reads "Evening Activities - TL" on every sheet.
   */
  delivery?: Delivery
}

const MEAL = '#a89a80'
const LOGISTICS = '#7f97ad'

export const ROUTINES: RoutineTemplate[] = [
  { id: 'breakfast', title: 'Breakfast', kind: 'meal', durationMin: 90, colour: MEAL, wholeSchool: true },
  { id: 'morning-tea', title: 'Morning Tea', kind: 'meal', durationMin: 30, colour: MEAL, wholeSchool: true },
  { id: 'lunch', title: 'Lunch', kind: 'meal', durationMin: 60, colour: MEAL, wholeSchool: true },
  { id: 'afternoon-tea', title: 'Afternoon Tea', kind: 'meal', durationMin: 30, colour: MEAL, wholeSchool: true },
  { id: 'dinner', title: 'Dinner', kind: 'meal', durationMin: 120, colour: MEAL, wholeSchool: true },
  { id: 'recess', title: 'Recess', kind: 'meal', durationMin: 15, colour: MEAL, wholeSchool: true },

  { id: 'arrival', title: 'Arrive / Unload bags\nWelcome Talk / Morning Tea', kind: 'logistics', durationMin: 30, colour: LOGISTICS, wholeSchool: true },
  { id: 'departure', title: 'Departure', kind: 'logistics', durationMin: 30, colour: LOGISTICS, wholeSchool: true },
  { id: 'prepare-departure', title: 'Prepare for Departure', kind: 'logistics', durationMin: 30, colour: LOGISTICS, wholeSchool: true },
  { id: 'bags-to-dorms', title: 'Move bags into Dorms', kind: 'logistics', durationMin: 30, colour: LOGISTICS, wholeSchool: true },
  { id: 'pack-clean', title: 'Pack bags, clean building,\nmove bags to store', kind: 'logistics', durationMin: 90, colour: LOGISTICS, wholeSchool: true },
  { id: 'free-time', title: 'Free Time', kind: 'logistics', durationMin: 30, colour: '#b3c3a8', wholeSchool: true },
  { id: 'evening-activities', title: 'Evening Activities', kind: 'logistics', durationMin: 90, colour: '#8e9bb3', wholeSchool: true, delivery: 'teacher_led' },
  { id: 'self-led', title: 'Self Led Activities', kind: 'logistics', durationMin: 90, colour: '#d0cfcf', wholeSchool: false },
  { id: 'own-activities', title: 'Own Activities', kind: 'logistics', durationMin: 90, colour: '#d0cfcf', wholeSchool: false },
  { id: 'return-to-camp', title: 'Return to camp', kind: 'logistics', durationMin: 30, colour: LOGISTICS, wholeSchool: true },
]
