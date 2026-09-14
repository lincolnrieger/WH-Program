import type { Activity } from '@/types'

/**
 * Activity catalogue.
 *
 * Colours are carried across verbatim from the "Activities Colour Key" sheet
 * (Woodhouse) and the "Key + Activity Notes" sheet (Roonka) so a printed plan
 * still reads the way staff are used to. Set-up / pack-down times and the
 * "don't run at the same time as…" rules come from the notes columns of those
 * same sheets.
 */
export const SEED_ACTIVITIES: Activity[] = [
  // ─── Woodhouse ────────────────────────────────────────────────────────────
  {
    id: 'adventurers-trail', name: "Adventurer's Trail", sites: ['woodhouse'],
    category: 'adventure', colour: '#00b050', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['adventurers-trail'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
    trainingNames: ['Adventures Trail'],
  },
  {
    id: 'junior-adventurers-trail', name: "Junior Adventurer's Trail", sites: ['woodhouse'],
    category: 'adventure', colour: '#33c477', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['adventurers-trail'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'bouldering', name: 'Bouldering', sites: ['woodhouse'],
    category: 'adventure', colour: '#ffc000', defaultDurationMin: 90,
    setupMin: 5, packdownMin: 5, venueIds: ['bouldering-wall'], capacity: 30,
    minStaff: 1, exclusive: true, conflictsWith: [], deliveries: ['staff', 'self_led'],
  },
  {
    id: 'bridge-building', name: 'Bridge Building', sites: ['woodhouse'],
    category: 'teamwork', colour: '#ba5d38', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['seeonee-lones-field'], minStaff: 1,
    conflictsWith: ['pioneering-construction'], deliveries: ['staff'],
    notes: 'Shares pioneering gear — do not run alongside Pioneering Construction.',
  },
  {
    id: 'bug-busters', name: 'Bug Busters', sites: ['woodhouse'],
    category: 'nature', colour: '#0400ff', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 20, venueIds: ['wetland', 'enviro-room'], minStaff: 1,
    conflictsWith: ['mandala-art', 'cox-creek-ecology'], deliveries: ['staff'],
    notes: 'Better before students do water activities. Not at the same time as Mandala Art.',
  },
  {
    id: 'campcraft', name: 'Campcraft', sites: ['woodhouse', 'roonka'],
    category: 'camping', colour: '#9e2d00', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['bunk-pit'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'campsite-setup', name: 'Campsite Setup', sites: ['woodhouse'],
    category: 'camping', colour: '#a7ffe0', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 0, venueIds: [], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'campsite-packup', name: 'Campsite Pack Up', sites: ['woodhouse'],
    category: 'camping', colour: '#00ee99', defaultDurationMin: 60,
    setupMin: 0, packdownMin: 30, venueIds: [], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'catapult-construction', name: 'Catapult Construction', sites: ['woodhouse'],
    category: 'teamwork', colour: '#a0522d', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['seeonee-lones-field'], minStaff: 1,
    conflictsWith: ['bridge-building', 'pioneering-construction'], deliveries: ['staff'],
  },
  {
    id: 'challenge-hill', name: 'Challenge Hill', sites: ['woodhouse'],
    category: 'adventure', colour: '#ff3399', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['challenge-hill'], capacity: 35,
    minStaff: 2, exclusive: true, conflictsWith: [], deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'challenge-hill-1', name: 'Challenge Hill Part 1', sites: ['woodhouse'],
    category: 'adventure', colour: '#ff3399', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['challenge-hill'], capacity: 35,
    minStaff: 2, exclusive: true, conflictsWith: ['challenge-hill-2'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'challenge-hill-2', name: 'Challenge Hill Part 2', sites: ['woodhouse'],
    category: 'adventure', colour: '#ff3399', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['challenge-hill'], capacity: 35,
    minStaff: 2, exclusive: true, conflictsWith: ['challenge-hill-1'],
    deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'camerons-climb', name: "Cameron's Climb", sites: ['woodhouse'],
    category: 'adventure', colour: '#e8a33d', defaultDurationMin: 75,
    setupMin: 10, packdownMin: 10, venueIds: ['camerons-climb'], minStaff: 1,
    exclusive: true, conflictsWith: [], deliveries: ['teacher_led', 'staff'],
  },
  {
    id: 'compass-navigation', name: 'Compass Navigation', sites: ['woodhouse'],
    category: 'navigation', colour: '#aeaaaa', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: ['orienteering'], deliveries: ['staff'],
  },
  {
    id: 'cox-creek-ecology', name: 'Cox Creek Ecology', sites: ['woodhouse'],
    category: 'nature', colour: '#2f9e9b', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['cox-creek'], minStaff: 1,
    conflictsWith: ['bug-busters'], deliveries: ['staff'],
  },
  {
    id: 'disc-golf', name: 'Disc Golf', sites: ['woodhouse'],
    category: 'games', colour: '#ff99ff', defaultDurationMin: 60,
    setupMin: 5, packdownMin: 5, venueIds: ['disc-golf-course'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led', 'self_led'],
  },
  {
    id: 'geocaching', name: 'Geocaching', sites: ['woodhouse', 'roonka'],
    category: 'navigation', colour: '#9999ff', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
    trainingNames: ['Geocaching (Junior)', 'Geocaching (Senior)'],
  },
  {
    id: 'ice-blocking', name: 'Ice Blocking', sites: ['woodhouse'],
    category: 'games', colour: '#5b9bd5', defaultDurationMin: 60,
    setupMin: 20, packdownMin: 15, venueIds: ['ice-blocking-field'], minStaff: 1,
    exclusive: true, conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'labyrinth', name: 'The Labyrinth', sites: ['woodhouse'],
    category: 'teamwork', colour: '#cc00ff', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['labyrinth'], capacity: 35,
    minStaff: 1, exclusive: true, conflictsWith: [],
    deliveries: ['staff', 'teacher_led', 'self_led'],
    trainingNames: ['Labyrinth'],
  },
  {
    id: 'laser-skirmish', name: 'Laser Skirmish', sites: ['woodhouse'],
    category: 'games', colour: '#ed7d31', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['laser-field'], capacity: 30,
    minStaff: 2, exclusive: true, conflictsWith: [], deliveries: ['staff'],
    notes: 'Needs an LIC-trained lead plus a second staff member.',
    trainingNames: ['Laser Skirmish LIC', 'Laser Skirmish 2nd'],
  },
  {
    id: 'lightweight-cooking', name: 'Lightweight Cooking', sites: ['woodhouse', 'roonka'],
    category: 'camping', colour: '#0099ff', defaultDurationMin: 120,
    setupMin: 20, packdownMin: 30, venueIds: ['bunk-pit'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
    notes: "Don't run before a water activity — students don't have enough time to change.",
    trainingNames: ['LW Cooking'],
  },
  {
    id: 'mandala-art', name: 'Mandala Art', sites: ['woodhouse', 'roonka'],
    category: 'craft', colour: '#570099', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 20, venueIds: ['craft-room'], minStaff: 1,
    conflictsWith: ['bug-busters', 'boomerang-craft'], deliveries: ['staff'],
    notes: 'Not at the same time as Boomerang Craft or Bug Busters.',
  },
  {
    id: 'nature-handicraft', name: 'Nature Handicraft', sites: ['woodhouse'],
    category: 'craft', colour: '#ffe699', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['craft-room'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'orienteering', name: 'Orienteering', sites: ['woodhouse', 'roonka'],
    category: 'navigation', colour: '#ff0000', defaultDurationMin: 90,
    setupMin: 5, packdownMin: 5, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: ['compass-navigation'], deliveries: ['staff', 'teacher_led'],
    notes: '45 min or 1.5 hr activity (1.5 hr for seniors).',
    trainingNames: ['Orienteering (45min)', 'Orienteering (1.5hrs)'],
  },
  {
    id: 'photo-hunt', name: 'Photo Hunt', sites: ['woodhouse', 'roonka'],
    category: 'games', colour: '#ff7a7a', defaultDurationMin: 45,
    setupMin: 5, packdownMin: 5, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led', 'self_led'],
    notes: '45 min activity.',
  },
  {
    id: 'pioneering-construction', name: 'Pioneering Construction', sites: ['woodhouse'],
    category: 'teamwork', colour: '#d1957d', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['seeonee-lones-field'], minStaff: 1,
    conflictsWith: ['bridge-building', 'catapult-construction'], deliveries: ['staff'],
  },
  {
    id: 'scats-tracks', name: 'Scats & Tracks', sites: ['woodhouse'],
    category: 'nature', colour: '#154d05', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 10, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
    trainingNames: ['Scats and Tracks'],
  },
  {
    id: 'survivor', name: 'Survivor', sites: ['woodhouse', 'roonka'],
    category: 'teamwork', colour: '#ffff00', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['survivor-shed'], minStaff: 1,
    exclusive: true, conflictsWith: ['web-of-life', 'echidna-trail'], deliveries: ['staff'],
    notes: 'Not at the same time as Web of Life or the Echidna Trail.',
  },
  {
    id: 'survival-challenge', name: 'Survival Challenge', sites: ['woodhouse'],
    category: 'teamwork', colour: '#c8b400', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['survivor-shed'], minStaff: 1,
    conflictsWith: ['survivor'], deliveries: ['staff'],
    trainingNames: ['Survival Challenge'],
  },
  {
    id: 'team-challenges', name: 'Team Challenges', sites: ['woodhouse', 'roonka'],
    category: 'teamwork', colour: '#4472c4', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['oval'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'tube-slide', name: 'Tube Slide', sites: ['woodhouse'],
    category: 'adventure', colour: '#66ccff', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['tube-slide'], capacity: 35,
    minStaff: 2, exclusive: true, conflictsWith: [], deliveries: ['staff'],
    notes: 'Needs an LIC-trained lead. Bottom-only supervision is a separate sign-off.',
    trainingNames: ['Tube Slide LIC'],
  },
  {
    id: 'tenting-setup', name: 'Tenting Adventure (Setup)', sites: ['woodhouse', 'roonka'],
    category: 'camping', colour: '#8fbc8f', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 30, venueIds: [], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'tenting-packdown', name: 'Tenting Adventure (Pack Down)', sites: ['woodhouse', 'roonka'],
    category: 'camping', colour: '#6b8e6b', defaultDurationMin: 60,
    setupMin: 15, packdownMin: 30, venueIds: [], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'shelter-building', name: 'Shelter Building', sites: ['woodhouse'],
    category: 'camping', colour: '#c55a11', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'woodhouse-explorers', name: 'Woodhouse Explorers', sites: ['woodhouse'],
    category: 'nature', colour: '#a9d08e', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'ponding-adventure', name: 'Ponding Adventure', sites: ['woodhouse'],
    category: 'nature', colour: '#706dff', defaultDurationMin: 90,
    setupMin: 25, packdownMin: 20, venueIds: ['wetland'], minStaff: 1,
    conflictsWith: ['bug-busters'], deliveries: ['staff'],
  },
  {
    id: 'wide-games', name: 'Wide Games', sites: ['woodhouse'],
    category: 'games', colour: '#f5b68b', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: ['woodhouse-property'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
  },
  {
    id: 'nature-art', name: 'Nature Art', sites: ['woodhouse'],
    category: 'craft', colour: '#e05a5a', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['craft-room'], minStaff: 1,
    conflictsWith: ['mandala-art'], deliveries: ['staff'],
  },
  {
    id: 'journaling', name: 'Journaling', sites: ['woodhouse'],
    category: 'craft', colour: '#b0a08c', defaultDurationMin: 60,
    setupMin: 5, packdownMin: 5, venueIds: [], minStaff: 0,
    conflictsWith: [], deliveries: ['teacher_led'],
  },
  {
    id: 'contingency', name: 'Contingency Activity', sites: ['woodhouse', 'roonka'],
    category: 'games', colour: '#9aa5b1', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 10, venueIds: [], minStaff: 1,
    conflictsWith: [], deliveries: ['staff', 'teacher_led'],
    notes: 'Wet-weather / fallback option.',
    trainingNames: ['Contingency Activities'],
  },

  // ─── Roonka ───────────────────────────────────────────────────────────────
  {
    id: 'boomerang-craft', name: 'Boomerang Craft', sites: ['roonka'],
    category: 'craft', colour: '#9000ff', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 30, venueIds: ['roonka-craft-room'], minStaff: 1,
    conflictsWith: ['mandala-art', 'bug-busters'], deliveries: ['staff'],
    notes: 'Not at the same time as Mandala Art or Bug Busters.',
  },
  {
    id: 'bouldering-gaga', name: 'Bouldering + Gaga Ball', sites: ['roonka'],
    category: 'adventure', colour: '#c86400', defaultDurationMin: 90,
    setupMin: 5, packdownMin: 5, venueIds: ['roonka-bouldering'], minStaff: 1,
    exclusive: true, conflictsWith: ['low-ropes'], deliveries: ['staff', 'teacher_led'],
    notes: 'Not at the same time as Low Ropes.',
  },
  {
    id: 'campfire-cooking', name: 'Campfire Cooking', sites: ['roonka'],
    category: 'camping', colour: '#ffcc99', defaultDurationMin: 120,
    setupMin: 30, packdownMin: 30, venueIds: ['campfire-circle'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
    notes: 'Works best straight after Campcraft — the fire has been going longer.',
  },
  {
    id: 'echidna-trail', name: 'Echidna Trail & Nature Scavenger Hunt', sites: ['roonka'],
    category: 'nature', colour: '#e8e85a', defaultDurationMin: 90,
    setupMin: 10, packdownMin: 5, venueIds: ['echidna-trail'], minStaff: 1,
    conflictsWith: ['survivor', 'web-of-life'], deliveries: ['staff', 'teacher_led'],
    notes: 'Not at the same time as Survivor or Web of Life — shared trail.',
    trainingNames: ['Nature scavenger hunt and Echidna trail'],
  },
  {
    id: 'fishing-yabbying', name: 'Fishing, Yabbying & Shrimp Catching', sites: ['roonka'],
    category: 'water', colour: '#ccff99', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 15, venueIds: ['river-frontage'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
    notes: 'Better before students do water activities.',
    trainingNames: ['Fishing, Yabbying and Shrimp Catching'],
  },
  {
    id: 'fur-feathers-feed', name: 'Fur, Feathers and Feed', sites: ['roonka'],
    category: 'nature', colour: '#d9b3a1', defaultDurationMin: 60,
    setupMin: 15, packdownMin: 15, venueIds: ['animal-yards'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'gaga-ball', name: 'Gaga Ball', sites: ['roonka'],
    category: 'games', colour: '#ffb347', defaultDurationMin: 45,
    setupMin: 5, packdownMin: 5, venueIds: ['roonka-bouldering'], minStaff: 0,
    conflictsWith: ['bouldering-gaga'], deliveries: ['teacher_led', 'self_led'],
  },
  {
    id: 'intro-kayaking', name: 'Intro to Kayaking', sites: ['roonka'],
    category: 'water', colour: '#9dc3e6', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 30, venueIds: ['river-frontage'], capacity: 30,
    minStaff: 3, exclusive: true, conflictsWith: ['kayaking-adventure', 'paddling-senior'],
    deliveries: ['staff'],
  },
  {
    id: 'kayaking-adventure', name: 'Kayaking Adventure', sites: ['roonka'],
    category: 'water', colour: '#2e75b6', defaultDurationMin: 120,
    setupMin: 30, packdownMin: 30, venueIds: ['river-frontage'], capacity: 30,
    minStaff: 4, exclusive: true, conflictsWith: ['intro-kayaking', 'paddling-senior'],
    deliveries: ['staff'],
  },
  {
    id: 'paddling-junior', name: 'Paddling (Junior)', sites: ['roonka'],
    category: 'water', colour: '#76b5e0', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 30, venueIds: ['river-frontage'], capacity: 25,
    minStaff: 3, exclusive: true, conflictsWith: ['paddling-senior', 'kayaking-adventure'],
    deliveries: ['staff'],
  },
  {
    id: 'paddling-senior', name: 'Paddling (Senior)', sites: ['roonka'],
    category: 'water', colour: '#1f6fb2', defaultDurationMin: 120,
    setupMin: 30, packdownMin: 30, venueIds: ['river-frontage'], capacity: 30,
    minStaff: 4, exclusive: true, conflictsWith: ['paddling-junior', 'kayaking-adventure'],
    deliveries: ['staff'],
    trainingNames: ['Paddling (Expo)'],
  },
  {
    id: 'low-ropes', name: 'Low Ropes', sites: ['roonka'],
    category: 'adventure', colour: '#c00000', defaultDurationMin: 90,
    setupMin: 40, packdownMin: 20, venueIds: ['low-ropes-course'], capacity: 30,
    minStaff: 2, exclusive: true, conflictsWith: ['bouldering-gaga'], deliveries: ['staff'],
    notes: 'Long set-up (40 min). Not at the same time as Bouldering + Gaga Ball.',
  },
  {
    id: 'raft-building', name: 'Raft Building', sites: ['roonka'],
    category: 'water', colour: '#66ccff', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['raft-bay'], capacity: 30,
    minStaff: 2, exclusive: true, conflictsWith: ['wet-and-wild'], deliveries: ['staff'],
    notes: "Not at the same time as 'Wet and Wild'.",
    trainingNames: ['Raft Building (junior)', 'Raft Building (senior)'],
  },
  {
    id: 'river-murray-ecology', name: 'River Murray Ecology', sites: ['roonka'],
    category: 'nature', colour: '#4a90a4', defaultDurationMin: 90,
    setupMin: 30, packdownMin: 20, venueIds: ['river-frontage'], minStaff: 1,
    conflictsWith: [], deliveries: ['staff'],
  },
  {
    id: 'water-adventures', name: 'Water Adventures', sites: ['roonka'],
    category: 'water', colour: '#ad5bff', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['river-frontage'], minStaff: 3,
    conflictsWith: [], deliveries: ['staff'],
    notes: 'Avoid on the last day. Groups can be combined (up to whole school).',
    trainingNames: ['Water Adventurers'],
  },
  {
    id: 'web-of-life', name: 'Web of Life', sites: ['roonka'],
    category: 'nature', colour: '#666699', defaultDurationMin: 90,
    setupMin: 20, packdownMin: 20, venueIds: ['echidna-trail'], minStaff: 1,
    conflictsWith: ['survivor', 'echidna-trail'], deliveries: ['staff'],
    notes: 'Not at the same time as Survivor or the Echidna Trail.',
  },
  {
    id: 'wet-and-wild', name: 'Wet and Wild', sites: ['roonka'],
    category: 'water', colour: '#ff99ff', defaultDurationMin: 90,
    setupMin: 15, packdownMin: 15, venueIds: ['river-frontage'], minStaff: 2,
    conflictsWith: ['raft-building'], deliveries: ['staff'],
    notes: 'Avoid on the last day. Groups can be combined.',
  },
  {
    id: 'wet-wild-relay', name: 'Wet and Wild Relay', sites: ['roonka'],
    category: 'water', colour: '#ff77e0', defaultDurationMin: 60,
    setupMin: 15, packdownMin: 15, venueIds: ['river-frontage'], minStaff: 2,
    conflictsWith: ['wet-and-wild', 'raft-building'], deliveries: ['staff'],
  },
]

/**
 * Non-activity blocks that make up the shape of a camp day. These appear in the
 * palette alongside activities so a whole day can be built without typing.
 */
export interface RoutineTemplate {
  id: string
  title: string
  kind: 'meal' | 'logistics'
  durationMin: number
  colour: string
  /** Applies to every group by default. */
  wholeSchool: boolean
}

export const ROUTINES: RoutineTemplate[] = [
  { id: 'breakfast', title: 'Breakfast', kind: 'meal', durationMin: 90, colour: '#c9a227', wholeSchool: true },
  { id: 'morning-tea', title: 'Morning Tea', kind: 'meal', durationMin: 30, colour: '#d4a05a', wholeSchool: true },
  { id: 'lunch', title: 'Lunch', kind: 'meal', durationMin: 60, colour: '#c9782a', wholeSchool: true },
  { id: 'afternoon-tea', title: 'Afternoon Tea', kind: 'meal', durationMin: 30, colour: '#d4a05a', wholeSchool: true },
  { id: 'dinner', title: 'Dinner', kind: 'meal', durationMin: 120, colour: '#a85c2e', wholeSchool: true },
  { id: 'recess', title: 'Recess', kind: 'meal', durationMin: 15, colour: '#d4a05a', wholeSchool: true },

  { id: 'arrival', title: 'Arrive / Unload bags\nWelcome Talk', kind: 'logistics', durationMin: 30, colour: '#5b7c99', wholeSchool: true },
  { id: 'departure', title: 'Departure', kind: 'logistics', durationMin: 30, colour: '#5b7c99', wholeSchool: true },
  { id: 'prepare-departure', title: 'Prepare for Departure', kind: 'logistics', durationMin: 30, colour: '#5b7c99', wholeSchool: true },
  { id: 'bags-to-dorms', title: 'Move bags into Dorms', kind: 'logistics', durationMin: 30, colour: '#6b8299', wholeSchool: true },
  { id: 'pack-clean', title: 'Pack bags, clean building,\nmove bags to store', kind: 'logistics', durationMin: 90, colour: '#6b8299', wholeSchool: true },
  { id: 'free-time', title: 'Free Time', kind: 'logistics', durationMin: 30, colour: '#7d9a6d', wholeSchool: true },
  { id: 'evening-activities', title: 'Evening Activities', kind: 'logistics', durationMin: 90, colour: '#3c4f6b', wholeSchool: true },
  { id: 'own-activities', title: 'Own Activities', kind: 'logistics', durationMin: 90, colour: '#8a8f98', wholeSchool: false },
  { id: 'return-to-camp', title: 'Return to camp', kind: 'logistics', durationMin: 30, colour: '#6b8299', wholeSchool: true },
]
