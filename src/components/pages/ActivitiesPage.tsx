import { useMemo, useState } from 'react'
import type { Activity, Site, Venue } from '@/types'
import { DELIVERY_LABELS } from '@/types'
import { SEED_ACTIVITIES } from '@/data/activities'
import { overridesOf } from '@/data/resolve'
import { blockPalette } from '@/lib/colour'
import { formatDuration } from '@/lib/time'
import { uid } from '@/lib/id'
import { useStore } from '@/store/useStore'
import { ActivityDialog } from './ActivityDialog'
import { Button, EmptyState, Input, cx } from '@/components/ui/primitives'

const SEED_IDS = new Set(SEED_ACTIVITIES.map((a) => a.id))

/** Manage the activity catalogue — what runs, how long, and what it needs. */
export function ActivitiesPage({
  site,
  activities,
  venues,
  dark,
}: {
  site: Site
  activities: Activity[]
  venues: Venue[]
  dark: boolean
}) {
  const doc = useStore((s) => s.doc)
  const saveActivity = useStore((s) => s.saveActivity)
  const deleteActivity = useStore((s) => s.deleteActivity)
  const restoreHidden = useStore((s) => s.restoreHiddenActivities)

  const [search, setSearch] = useState('')
  const [allSites, setAllSites] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)

  const overrides = overridesOf(doc)
  const venueNames = useMemo(() => new Map(venues.map((v) => [v.id, v.name])), [venues])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activities.filter((activity) => {
      if (!allSites && !activity.sites.includes(site)) return false
      if (!query) return true
      return (
        activity.name.toLowerCase().includes(query) ||
        (activity.notes?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [activities, site, allSites, search])

  function addActivity() {
    setEditing({
      id: uid('act'),
      name: '',
      sites: [site],
      colour: '#4472c4',
      defaultDurationMin: 90,
      setupMin: 10,
      packdownMin: 10,
      venueIds: [],
      minStaff: 1,
      conflictsWith: [],
      deliveries: ['staff'],
    })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--ink)]">Activities</h1>
          <p className="text-[11.5px] text-[var(--ink-soft)]">
            {visible.length} shown · edits here change what the scheduler checks
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {overrides.hiddenActivityIds.length > 0 && (
            <Button size="sm" onClick={restoreHidden}>
              Restore {overrides.hiddenActivityIds.length} removed
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={addActivity}>
            + Activity
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-1.5">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search activities…"
          aria-label="Search activities"
          className="w-56"
        />
        <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={allSites}
            onChange={(event) => setAllSites(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          Show both sites
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <EmptyState
            title="No activities match"
            body="Try a different search, or add a new activity."
            action={
              <Button variant="primary" onClick={addActivity}>
                + Activity
              </Button>
            }
          />
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-[var(--surface)]">
              <tr className="border-b border-[var(--line)] text-left text-[11px] text-[var(--ink-faint)]">
                <Th className="pl-3">Activity</Th>
                <Th className="text-right">Runs</Th>
                <Th className="text-right">Set-up</Th>
                <Th className="text-right">Pack-down</Th>
                <Th className="text-right">Staff</Th>
                <Th className="text-right">Cap</Th>
                <Th>Venue</Th>
                <Th>Offered as</Th>
                <Th className="pr-3">Rules</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((activity) => {
                const palette = blockPalette(activity.colour, dark)
                const custom = !SEED_IDS.has(activity.id)
                const edited = Boolean(overrides.activities[activity.id])
                return (
                  <tr
                    key={activity.id}
                    onClick={() => setEditing(activity)}
                    className="cursor-pointer border-b border-[var(--line)] hover:bg-[var(--surface-sunk)] [&>td]:px-2 [&>td]:py-1.5"
                  >
                    <td className="py-1.5 pl-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-4 w-1.5 shrink-0 rounded-sm"
                          style={{ background: palette.rail }}
                        />
                        <span className="font-medium text-[var(--ink)]">{activity.name}</span>
                        {custom && <Tag>added</Tag>}
                        {edited && <Tag>edited</Tag>}
                        {activity.exclusive && <Tag title="Only one group at a time">exclusive</Tag>}
                      </span>
                    </td>
                    <td className="tnum text-right text-[var(--ink-soft)]">
                      {formatDuration(activity.defaultDurationMin)}
                    </td>
                    <td className="tnum text-right text-[var(--ink-faint)]">{activity.setupMin}m</td>
                    <td className="tnum text-right text-[var(--ink-faint)]">
                      {activity.packdownMin}m
                    </td>
                    <td className="tnum text-right text-[var(--ink-soft)]">
                      {activity.minStaff || '—'}
                    </td>
                    <td className="tnum text-right text-[var(--ink-soft)]">
                      {activity.capacity ?? '—'}
                    </td>
                    <td className="max-w-[140px] truncate text-[var(--ink-soft)]">
                      {activity.venueIds.map((id) => venueNames.get(id) ?? id).join(', ') || '—'}
                    </td>
                    <td className="max-w-[150px] truncate text-[11.5px] text-[var(--ink-faint)]">
                      {activity.deliveries.map((d) => DELIVERY_LABELS[d]).join(', ')}
                    </td>
                    <td className="max-w-[160px] truncate pr-3 text-[11.5px] text-[var(--ink-faint)]">
                      {activity.conflictsWith.length > 0
                        ? `${activity.conflictsWith.length} clash rule${activity.conflictsWith.length === 1 ? '' : 's'}`
                        : activity.notes
                          ? activity.notes
                          : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ActivityDialog
          activity={editing}
          allActivities={activities}
          venues={venues}
          dark={dark}
          onSave={saveActivity}
          onDelete={editing.name ? () => deleteActivity(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cx('px-2 py-1.5 font-medium', className)}>{children}</th>
}

function Tag({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded-full bg-[var(--surface-sunk)] px-1.5 py-px text-[10px] font-medium text-[var(--ink-faint)]"
    >
      {children}
    </span>
  )
}

