import type { Venue } from '@/types'

/**
 * Venues taken from the location column of the Activities Colour Key sheet,
 * plus the basecamps and buildings referenced across the holistic itineraries.
 */
export const SEED_VENUES: Venue[] = [
  // Woodhouse
  { id: 'survivor-shed', name: 'Survivor Shed', sites: ['woodhouse'] },
  { id: 'bunk-pit', name: 'Bunk Pit', sites: ['woodhouse'] },
  { id: 'ice-blocking-field', name: 'Ice Blocking Field', sites: ['woodhouse'] },
  { id: 'seeonee-lones-field', name: 'Seeonee / Lones Field', sites: ['woodhouse'] },
  { id: 'brownsea', name: 'Brownsea', sites: ['woodhouse'] },
  { id: 'woodhouse-property', name: 'Woodhouse Property', sites: ['woodhouse'] },
  { id: 'craft-room', name: 'Craft Room', sites: ['woodhouse'], capacity: 40 },
  { id: 'wetland', name: 'Wetland', sites: ['woodhouse'] },
  { id: 'st-george-field', name: 'St George Field', sites: ['woodhouse'] },
  { id: 'manor-creek', name: 'Manor Creek', sites: ['woodhouse'] },
  { id: 'henders-pit', name: 'Henders Pit', sites: ['woodhouse'] },
  { id: 'enviro-room', name: 'Enviro Room', sites: ['woodhouse'], capacity: 40 },
  { id: 'challenge-hill', name: 'Challenge Hill', sites: ['woodhouse'] },
  { id: 'labyrinth', name: 'The Labyrinth', sites: ['woodhouse'] },
  { id: 'tube-slide', name: 'Tube Slide', sites: ['woodhouse'] },
  { id: 'bouldering-wall', name: 'Bouldering Wall', sites: ['woodhouse'] },
  { id: 'laser-field', name: 'Laser Skirmish Field', sites: ['woodhouse'] },
  { id: 'camerons-climb', name: "Cameron's Climb", sites: ['woodhouse'] },
  { id: 'cox-creek', name: 'Cox Creek', sites: ['woodhouse'] },
  { id: 'disc-golf-course', name: 'Disc Golf Course', sites: ['woodhouse'] },
  { id: 'adventurers-trail', name: "Adventurer's Trail", sites: ['woodhouse'] },

  // Roonka
  { id: 'river-frontage', name: 'River Frontage', sites: ['roonka'] },
  { id: 'low-ropes-course', name: 'Low Ropes Course', sites: ['roonka'] },
  { id: 'roonka-bouldering', name: 'Bouldering + Gaga Ball', sites: ['roonka'] },
  { id: 'raft-bay', name: 'Raft Bay', sites: ['roonka'] },
  { id: 'campfire-circle', name: 'Campfire Circle', sites: ['roonka'] },
  { id: 'animal-yards', name: 'Animal Yards', sites: ['roonka'] },
  { id: 'echidna-trail', name: 'Echidna Trail', sites: ['roonka'] },
  { id: 'roonka-craft-room', name: 'Craft Room', sites: ['roonka'], capacity: 40 },

  // Shared / generic
  { id: 'dining-hall', name: 'Dining Hall', sites: ['woodhouse', 'roonka'] },
  { id: 'oval', name: 'Oval', sites: ['woodhouse', 'roonka'] },
]

/** Accommodation options, used on the booking header line. */
export const BUILDINGS: Record<string, string[]> = {
  woodhouse: [
    'Manor',
    'Rymill',
    'Bunkhouse',
    'Gilwell Basecamp',
    'St George Basecamp',
    'Brownsea Basecamp',
    'Stags',
    'Tenting',
  ],
  roonka: ['Bunkhouses', 'Lodge', 'Tenting', 'Riverside Camp'],
}
