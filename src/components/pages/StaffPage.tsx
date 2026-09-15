import { useMemo, useState } from 'react'
import type { Activity, CompetencyLevel, Site, StaffMember } from '@/types'
import { COMPETENCY_COLOURS, COMPETENCY_LABELS, COMPETENCY_SHORT, QUALIFIED_LEVELS } from '@/types'
import { competencyFor, overridesOf } from '@/data/resolve'
import { readableText } from '@/lib/colour'
import { uid } from '@/lib/id'
import { useStore } from '@/store/useStore'
import { LevelLegend, LevelPicker, PICKABLE_LEVELS } from './LevelPicker'
import { Button, EmptyState, Input, cx } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'

type Mode = 'person' | 'matrix'

/**
 * Staff training.
 *
 * The seed data comes from the training workbook, where competency is encoded
 * as a cell fill colour. Anything set here is stored as an override on top, so
 * re-importing the workbook later won't wipe out changes made in the app — and
 * an overridden cell is marked so you can tell the two apart.
 */
export function StaffPage({
  site,
  activities,
  staff,
}: {
  site: Site
  activities: Activity[]
  staff: StaffMember[]
}) {
  const doc = useStore((s) => s.doc)
  const setCompetency = useStore((s) => s.setCompetency)
  const setCompetencyBulk = useStore((s) => s.setCompetencyBulk)
  const saveStaff = useStore((s) => s.saveStaff)
  const deleteStaff = useStore((s) => s.deleteStaff)

  const [mode, setMode] = useState<Mode>('person')
  const [search, setSearch] = useState('')
  const [activitySearch, setActivitySearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [qualifiedOnly, setQualifiedOnly] = useState(false)

  const overrides = overridesOf(doc)
  const siteActivities = useMemo(
    () => activities.filter((a) => a.sites.includes(site)),
    [activities, site],
  )
  const siteStaff = useMemo(
    () => staff.filter((person) => person.sites.includes(site)),
    [staff, site],
  )

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase()
    return siteStaff.filter((person) => !query || person.name.toLowerCase().includes(query))
  }, [siteStaff, search])

  const selected = useMemo(
    () => filteredStaff.find((p) => p.id === selectedId) ?? filteredStaff[0],
    [filteredStaff, selectedId],
  )

  const visibleActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase()
    return siteActivities.filter((a) => !query || a.name.toLowerCase().includes(query))
  }, [siteActivities, activitySearch])

  /** How many activities a person is signed off to run, for the list summary. */
  const qualifiedCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const person of siteStaff) {
      let total = 0
      for (const activity of siteActivities) {
        if (QUALIFIED_LEVELS.includes(competencyFor(person, activity, site, overrides).level)) {
          total += 1
        }
      }
      counts.set(person.id, total)
    }
    return counts
  }, [siteStaff, siteActivities, site, overrides])

  function addStaff() {
    const person: StaffMember = {
      id: uid('stf'),
      name: 'New staff member',
      sites: [site],
      competency: [],
    }
    saveStaff(person)
    setSelectedId(person.id)
    setEditing(person)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--ink)]">Staff training</h1>
          <p className="text-[11.5px] text-[var(--ink-soft)]">
            {siteStaff.length} staff · {siteActivities.length} activities at this site
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-md border border-[var(--line)] p-0.5">
            {(['person', 'matrix'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cx(
                  'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                  mode === value
                    ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                {value === 'person' ? 'By person' : 'Full matrix'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="primary" onClick={addStaff}>
            + Staff member
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-sunk)] px-3 py-1.5">
        <LevelLegend />
        <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
          <span aria-hidden className="text-[9px] text-[var(--brand)]">
            &#9679;
          </span>
          changed here
        </span>
      </div>

      {mode === 'person' ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[248px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
            <div className="p-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search staff…"
                aria-label="Search staff"
              />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
              {filteredStaff.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(person.id)}
                    className={cx(
                      'mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                      selected?.id === person.id
                        ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                        : 'text-[var(--ink)] hover:bg-[var(--surface-sunk)]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {person.name}
                    </span>
                    <span className="tnum shrink-0 text-[10.5px] text-[var(--ink-faint)]">
                      {qualifiedCount.get(person.id) ?? 0}
                    </span>
                  </button>
                </li>
              ))}
              {filteredStaff.length === 0 && (
                <p className="px-2 py-4 text-[12px] text-[var(--ink-faint)]">No staff match.</p>
              )}
            </ul>
          </div>

          {selected ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-semibold text-[var(--ink)]">
                    {selected.name}
                  </h2>
                  <p className="text-[11.5px] text-[var(--ink-soft)]">
                    Signed off for {qualifiedCount.get(selected.id) ?? 0} of{' '}
                    {siteActivities.length} activities
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Input
                    value={activitySearch}
                    onChange={(event) => setActivitySearch(event.target.value)}
                    placeholder="Filter activities…"
                    aria-label="Filter activities"
                    className="w-44"
                  />
                  <Button size="sm" onClick={() => setEditing(selected)}>
                    Edit details
                  </Button>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--line)] px-3 py-1.5">
                <span className="text-[11px] text-[var(--ink-faint)]">Set all shown to:</span>
                {PICKABLE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    title={`Set every shown activity to “${COMPETENCY_LABELS[level]}”`}
                    onClick={() =>
                      setCompetencyBulk(
                        visibleActivities.map((activity) => ({
                          staffId: selected.id,
                          site,
                          activityId: activity.id,
                          level,
                        })),
                      )
                    }
                    className="flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold transition-transform hover:scale-110"
                    style={{
                      background: COMPETENCY_COLOURS[level],
                      color: readableText(COMPETENCY_COLOURS[level]),
                    }}
                  >
                    {COMPETENCY_SHORT[level] || '·'}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <ul className="divide-y divide-[var(--line)]">
                  {visibleActivities.map((activity) => {
                    const entry = competencyFor(selected, activity, site, overrides)
                    return (
                      <li
                        key={activity.id}
                        className="flex items-center gap-3 px-3 py-1.5 hover:bg-[var(--surface-sunk)]"
                      >
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: activity.colour }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink)]">
                          {activity.name}
                        </span>
                        {entry.note && (
                          <span
                            className="shrink-0 truncate text-[11px] text-[var(--ink-faint)]"
                            title={entry.note}
                          >
                            {entry.note}
                          </span>
                        )}
                        <LevelPicker
                          value={entry.level}
                          edited={entry.source === 'edited'}
                          onChange={(level) =>
                            setCompetency(selected.id, site, activity.id, level)
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
                {visibleActivities.length === 0 && (
                  <p className="px-3 py-6 text-[12px] text-[var(--ink-faint)]">
                    No activities match “{activitySearch}”.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No staff yet"
              body="Add a staff member to start recording what they're trained on."
              action={
                <Button variant="primary" onClick={addStaff}>
                  + Staff member
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <MatrixView
          activities={siteActivities}
          staff={filteredStaff}
          site={site}
          overrides={overrides}
          search={search}
          onSearch={setSearch}
          qualifiedOnly={qualifiedOnly}
          onQualifiedOnly={setQualifiedOnly}
          onSet={(staffId, activityId, level) => setCompetency(staffId, site, activityId, level)}
        />
      )}

      {editing && (
        <StaffDialog
          person={editing}
          onSave={(next) => saveStaff(next)}
          onDelete={() => {
            deleteStaff(editing.id)
            setSelectedId(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

/**
 * The dense view, closest to the training workbook: activities down, staff
 * across. Clicking a cell steps it to the next level.
 */
function MatrixView({
  activities, staff, site, overrides, search, onSearch, qualifiedOnly, onQualifiedOnly, onSet,
}: {
  activities: Activity[]
  staff: StaffMember[]
  site: Site
  overrides: ReturnType<typeof overridesOf>
  search: string
  onSearch: (value: string) => void
  qualifiedOnly: boolean
  onQualifiedOnly: (value: boolean) => void
  onSet: (staffId: string, activityId: string, level: CompetencyLevel | null) => void
}) {
  const cells = useMemo(() => {
    const map = new Map<string, ReturnType<typeof competencyFor>>()
    for (const person of staff) {
      for (const activity of activities) {
        map.set(`${person.id}:${activity.id}`, competencyFor(person, activity, site, overrides))
      }
    }
    return map
  }, [staff, activities, site, overrides])

  const shownStaff = useMemo(() => {
    if (!qualifiedOnly) return staff
    return staff.filter((person) =>
      activities.some((activity) =>
        QUALIFIED_LEVELS.includes(cells.get(`${person.id}:${activity.id}`)?.level ?? 'unknown'),
      ),
    )
  }, [staff, activities, qualifiedOnly, cells])

  function cycle(current: CompetencyLevel): CompetencyLevel | null {
    const index = PICKABLE_LEVELS.indexOf(current)
    // Stepping past the last level clears the override.
    if (index === -1) return PICKABLE_LEVELS[0]
    return index >= PICKABLE_LEVELS.length - 1 ? null : PICKABLE_LEVELS[index + 1]
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 py-1.5">
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search staff…"
          aria-label="Search staff"
          className="w-56"
        />
        <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={qualifiedOnly}
            onChange={(event) => onQualifiedOnly(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          Only staff signed off for something
        </label>
        <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
          Click a cell to step through the levels
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 min-w-[190px] border-r border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-left text-[11px] font-semibold text-[var(--ink-faint)]">
                Activity
              </th>
              {shownStaff.map((person) => (
                <th
                  key={person.id}
                  className="sticky top-0 z-20 h-[104px] w-[26px] border-r border-b border-[var(--line)] bg-[var(--surface)] p-0 align-bottom"
                  title={person.name}
                >
                  <span className="flex h-[104px] w-[26px] items-end justify-center pb-1.5">
                    <span
                      className="max-h-[92px] truncate text-[11px] font-medium text-[var(--ink-soft)]"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {person.name}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id} className="hover:bg-[var(--surface-sunk)]">
                <th className="sticky left-0 z-10 border-r border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-left font-normal">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: activity.colour }}
                    />
                    <span className="truncate text-[12px] text-[var(--ink)]">{activity.name}</span>
                  </span>
                </th>
                {shownStaff.map((person) => {
                  const entry = cells.get(`${person.id}:${activity.id}`)
                  const level = entry?.level ?? 'unknown'
                  const colour = COMPETENCY_COLOURS[level]
                  return (
                    <td
                      key={person.id}
                      className="border-r border-b border-[var(--line)] p-0"
                    >
                      <button
                        type="button"
                        onClick={() => onSet(person.id, activity.id, cycle(level))}
                        title={`${person.name} — ${activity.name}: ${COMPETENCY_LABELS[level]}`}
                        className="flex h-[26px] w-[26px] items-center justify-center text-[10px] font-bold transition-transform hover:scale-125"
                        style={{
                          background: level === 'unknown' ? 'transparent' : colour,
                          color: level === 'unknown' ? 'var(--ink-faint)' : readableText(colour),
                        }}
                      >
                        {COMPETENCY_SHORT[level] || ''}
                        {entry?.source === 'edited' && (
                          <span aria-hidden className="absolute mt-[-14px] ml-[14px] text-[7px] text-[var(--brand)]">
                            &#9679;
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Name, sites and removal for one staff member. */
function StaffDialog({
  person,
  onSave,
  onDelete,
  onClose,
}: {
  person: StaffMember
  onSave: (person: StaffMember) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(person)

  return (
    <Modal
      title="Staff member"
      width={420}
      onClose={onClose}
      footer={
        <>
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
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Name
          </span>
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            autoFocus
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Works at
          </span>
          <div className="flex gap-3">
            {(['woodhouse', 'roonka'] as const).map((value) => (
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

        <p className="rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
          Removing someone hides them from the app and takes them off any sessions
          they were rostered on. Their training data is kept, so they can be
          restored by re-importing the workbook.
        </p>
      </div>
    </Modal>
  )
}
