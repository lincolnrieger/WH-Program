import type { Activity, Block, Booking, ProgramDocument } from '@/types'
import { DELIVERY_SUFFIX, SITES } from '@/types'
import { dateRange, formatDate, formatTime } from './time'

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'program'
}

/**
 * A staff member's name as it should read anywhere the roster is shown.
 *
 * Someone on a session to be trained rather than to run it gets a trailing
 * `#` — the convention the paper run sheets already use.
 */
export function staffLabel(block: Block, staffId: string, name: string): string {
  return block.trainingStaffIds?.includes(staffId) ? `${name} #` : name
}

/** Names of everyone rostered on a block, trainees marked with `#`. */
export function staffLabels(block: Block, names: Map<string, { name: string }>): string[] {
  return block.staffIds.map((id) => staffLabel(block, id, names.get(id)?.name ?? id))
}

/** Title as it should read on the grid and in exports, including the TL suffix. */
export function blockTitle(block: Block, activity?: Activity): string {
  const base = block.title ?? activity?.name ?? 'Untitled'
  // Titles typed by hand may already carry the suffix; don't double it up.
  const suffix = DELIVERY_SUFFIX[block.delivery]
  if (!suffix || base.includes(suffix.trim())) return base
  return base + suffix
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * One row per scheduled block. This is the shape that pastes cleanly back into
 * Excel for anyone who still wants the spreadsheet.
 */
export function exportCsv(
  doc: ProgramDocument,
  activities: Map<string, Activity>,
  venues: Map<string, { name: string }>,
  staff: Map<string, { name: string }>,
): void {
  const site = SITES.find((s) => s.id === doc.site)?.short ?? 'Woodhouse'

  const header = [
    'Date', 'Day', 'School', 'Year level', 'Package', 'Building',
    'Group', 'Start', 'End', 'Duration (min)', 'Activity', 'Delivery',
    'Venue', 'Staff', 'Notes',
  ]

  const rows: string[][] = []
  const bookingById = new Map(doc.bookings.map((b) => [b.id, b]))

  const sorted = [...doc.blocks].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin,
  )

  for (const block of sorted) {
    const booking = bookingById.get(block.bookingId)
    if (!booking) continue
    const activity = block.activityId ? activities.get(block.activityId) : undefined
    const groupNames = block.groupIds
      .map((id) => booking.groups.find((g) => g.id === id)?.name ?? id)
      .join(' + ')

    rows.push([
      block.date,
      formatDate(block.date).split(' ')[0],
      booking.schoolName,
      booking.yearLevel,
      booking.packageTier,
      booking.building,
      groupNames,
      formatTime(block.startMin),
      formatTime(block.endMin),
      String(block.endMin - block.startMin),
      blockTitle(block, activity).replace(/\n/g, ' '),
      block.delivery,
      block.venueId ? venues.get(block.venueId)?.name ?? block.venueId : '',
      staffLabels(block, staff).join(', '),
      (block.note ?? '').replace(/\n/g, ' '),
    ])
  }

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  downloadFile(
    `${safeName(site)}-schedule-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    'text/csv;charset=utf-8',
  )
}

/** Header line matching the existing sheets: "School - Year - 45est / Package - Building". */
export function bookingHeadline(booking: Booking): string {
  const parts = [booking.schoolName, booking.yearLevel]
  if (booking.studentCount) parts.push(`${booking.studentCount}est`)
  return parts.filter(Boolean).join(' - ')
}

export function bookingSubhead(booking: Booking): string {
  const tier = booking.packageTier === 'custom' ? '' : booking.packageTier
  return [tier ? tier[0].toUpperCase() + tier.slice(1) : '', booking.building]
    .filter(Boolean)
    .join(' - ')
}

export function bookingDates(booking: Booking): string[] {
  return dateRange(booking.startDate, booking.endDate)
}
