import { useMemo, useState } from 'react'
import type { Activity, Site, Venue } from '@/types'
import { SEED_VENUES } from '@/data/venues'
import { uid } from '@/lib/id'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button, EmptyState, Field, Input, cx } from '@/components/ui/primitives'

const SEED_IDS = new Set(SEED_VENUES.map((v) => v.id))

/**
 * Venues — the spaces activities run in. Clash detection uses these: two groups
 * can't be in the same place at the same time, whichever school they're with.
 */
export function VenuesPage({
  site,
  venues,
  activities,
}: {
  site: Site
  venues: Venue[]
  activities: Activity[]
}) {
  const saveVenue = useStore((s) => s.saveVenue)
  const deleteVenue = useStore((s) => s.deleteVenue)

  const [search, setSearch] = useState('')
  const [allSites, setAllSites] = useState(false)
  const [editing, setEditing] = useState<Venue | null>(null)

  /** Which activities point at each venue — shown so removals aren't a surprise. */
  const usage = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const activity of activities) {
      for (const venueId of activity.venueIds) {
        const list = map.get(venueId)
        if (list) list.push(activity.name)
        else map.set(venueId, [activity.name])
      }
    }
    return map
  }, [activities])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return venues.filter((venue) => {
      if (!allSites && !venue.sites.includes(site)) return false
      return !query || venue.name.toLowerCase().includes(query)
    })
  }, [venues, site, allSites, search])

  function addVenue() {
    setEditing({ id: uid('ven'), name: '', sites: [site] })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--ink)]">Venues</h1>
          <p className="text-[11.5px] text-[var(--ink-soft)]">
            {visible.length} shown · used to spot two groups sent to the same place
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search venues…"
            aria-label="Search venues"
            className="w-48"
          />
          <label className="flex items-center gap-1.5 text-[11.5px] whitespace-nowrap text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={allSites}
              onChange={(event) => setAllSites(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--brand)]"
            />
            Both sites
          </label>
          <Button size="sm" variant="primary" onClick={addVenue}>
            + Venue
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {visible.length === 0 ? (
          <EmptyState
            title="No venues match"
            body="Try a different search, or add a venue."
            action={
              <Button variant="primary" onClick={addVenue}>
                + Venue
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {visible.map((venue) => {
              const used = usage.get(venue.id) ?? []
              return (
                <li key={venue.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(venue)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                          {venue.name}
                        </span>
                        {!SEED_IDS.has(venue.id) && (
                          <span className="rounded-full bg-[var(--surface-sunk)] px-1.5 py-px text-[10px] text-[var(--ink-faint)]">
                            added
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--ink-faint)]">
                        {used.length > 0 ? used.join(' · ') : 'Not used by any activity yet'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-[var(--ink-soft)]">
                      {venue.sites.map((s) => (s === 'woodhouse' ? 'Woodhouse' : 'Roonka')).join(', ')}
                    </span>
                    {venue.capacity && (
                      <span className="tnum w-16 shrink-0 text-right text-[11.5px] text-[var(--ink-soft)]">
                        {venue.capacity} max
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing && (
        <VenueDialog
          venue={editing}
          usedBy={usage.get(editing.id) ?? []}
          onSave={saveVenue}
          onDelete={editing.name ? () => deleteVenue(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

function VenueDialog({
  venue,
  usedBy,
  onSave,
  onDelete,
  onClose,
}: {
  venue: Venue
  usedBy: string[]
  onSave: (venue: Venue) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(venue)

  return (
    <Modal
      title={venue.name ? 'Edit venue' : 'New venue'}
      width={420}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                onDelete()
                onClose()
              }}
            >
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!draft.name.trim() || draft.sites.length === 0}
            onClick={() => {
              onSave({ ...draft, name: draft.name.trim() })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            autoFocus
            placeholder="e.g. Survivor Shed"
          />
        </Field>

        <Field label="Capacity" hint="Leave blank if the space has no practical limit.">
          <Input
            type="number"
            min={0}
            value={draft.capacity ?? ''}
            onChange={(event) =>
              setDraft({
                ...draft,
                capacity: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </Field>

        <div>
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Site
          </span>
          <div className="flex gap-3">
            {(['woodhouse', 'roonka'] as Site[]).map((value) => (
              <label key={value} className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={draft.sites.includes(value)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sites: event.target.checked
                        ? [...draft.sites, value]
                        : draft.sites.filter((s) => s !== value),
                    })
                  }
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                {value === 'woodhouse' ? 'Woodhouse' : 'Roonka'}
              </label>
            ))}
          </div>
        </div>

        {usedBy.length > 0 && (
          <p className={cx('rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11.5px] leading-snug text-[var(--ink-soft)]')}>
            Used by {usedBy.length} activit{usedBy.length === 1 ? 'y' : 'ies'}: {usedBy.join(', ')}.
            Removing it clears the venue from those and from anything already scheduled.
          </p>
        )}
      </div>
    </Modal>
  )
}
