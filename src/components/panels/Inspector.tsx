import { useMemo, useState } from 'react'
import type { Activity, Block, Booking, Issue, Site, Venue } from '@/types'
import { BLOCK_KIND_LABELS, COMPETENCY_COLOURS, DELIVERY_LABELS } from '@/types'
import { availableStaff } from '@/lib/conflicts'
import { formatDuration, formatTimeFull, parseTime } from '@/lib/time'
import { blockTitle } from '@/lib/exportImport'
import { buildConflictContext, useStore } from '@/store/useStore'
import { Button, Chip, Field, IconButton, Input, Select, cx } from '@/components/ui/primitives'

export interface InspectorProps {
  blocks: Block[]
  booking: Booking | undefined
  activities: Map<string, Activity>
  venues: Venue[]
  site: Site
  issues: Issue[]
  onClose: () => void
}

/**
 * Edits whatever is currently selected. Multi-selection edits the fields that
 * make sense in bulk (time, delivery, venue) and leaves the rest alone.
 */
export function Inspector({ blocks, booking, activities, venues, site, issues, onClose }: InspectorProps) {
  const updateBlock = useStore((s) => s.updateBlock)
  const updateBlocks = useStore((s) => s.updateBlocks)
  const removeBlocks = useStore((s) => s.removeBlocks)
  const duplicateBlocks = useStore((s) => s.duplicateBlocks)

  const single = blocks.length === 1 ? blocks[0] : undefined
  const ids = blocks.map((b) => b.id)
  const activity = single?.activityId ? activities.get(single.activityId) : undefined

  const relevantIssues = useMemo(
    () => issues.filter((issue) => issue.blockIds.some((id) => ids.includes(id))),
    [issues, ids],
  )

  const siteVenues = useMemo(() => venues.filter((v) => v.sites.includes(site)), [venues, site])

  if (blocks.length === 0) return null

  return (
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <h2 className="truncate text-[13px] font-semibold">
          {single ? blockTitle(single, activity) : `${blocks.length} blocks selected`}
        </h2>
        <IconButton label="Close inspector" onClick={onClose}>
          &#10005;
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {relevantIssues.length > 0 && (
          <div className="space-y-1.5">
            {relevantIssues.map((issue) => (
              <p
                key={issue.id}
                className="rounded-md border px-2 py-1.5 text-[11.5px] leading-snug"
                style={{
                  background:
                    issue.severity === 'error' ? 'var(--danger-tint)'
                    : issue.severity === 'warning' ? 'var(--warn-tint)'
                    : 'var(--info-tint)',
                  borderColor: 'transparent',
                  color:
                    issue.severity === 'error' ? 'var(--danger)'
                    : issue.severity === 'warning' ? 'var(--warn)'
                    : 'var(--info)',
                }}
              >
                {issue.message}
              </p>
            ))}
          </div>
        )}

        <TimeFields blocks={blocks} onChange={(patch) => updateBlocks(ids, patch)} />

        {single && (
          <Field label="Title">
            <Input
              value={single.title ?? activity?.name ?? ''}
              placeholder={activity?.name ?? 'Block title'}
              onChange={(event) => updateBlock(single.id, { title: event.target.value || undefined })}
            />
          </Field>
        )}

        <Field label="Delivery">
          <Select
            value={single?.delivery ?? ''}
            onChange={(event) =>
              updateBlocks(ids, { delivery: event.target.value as Block['delivery'] })
            }
          >
            {!single && <option value="">Mixed — choose to set all</option>}
            {(['staff', 'teacher_led', 'self_led'] as const).map((value) => (
              <option key={value} value={value}>
                {DELIVERY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Venue">
          <Select
            value={single?.venueId ?? ''}
            onChange={(event) => updateBlocks(ids, { venueId: event.target.value || undefined })}
          >
            <option value="">No venue</option>
            {siteVenues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </Select>
        </Field>

        {booking && single && (
          <Field label="Groups" hint="Select more than one to merge the block across columns.">
            <div className="flex flex-wrap gap-1">
              {booking.groups.map((group) => {
                const on = single.groupIds.includes(group.id)
                return (
                  <Chip
                    key={group.id}
                    active={on}
                    onClick={() => {
                      const next = on
                        ? single.groupIds.filter((id) => id !== group.id)
                        : [...single.groupIds, group.id]
                      if (next.length === 0) return
                      updateBlock(single.id, { groupIds: next })
                    }}
                  >
                    {group.name}
                  </Chip>
                )
              })}
              <Chip onClick={() => updateBlock(single.id, { groupIds: booking.groups.map((g) => g.id) })}>
                All
              </Chip>
            </div>
          </Field>
        )}

        {single && booking && single.delivery === 'staff' && (
          <StaffPicker block={single} site={booking.site} />
        )}

        {single && (
          <Field label="Note">
            <textarea
              value={single.note ?? ''}
              onChange={(event) => updateBlock(single.id, { note: event.target.value || undefined })}
              rows={2}
              placeholder="Anything staff need to know…"
              className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-soft)] focus:outline-none"
            />
          </Field>
        )}

        {single && (
          <Field label="Type">
            <Select
              value={single.kind}
              onChange={(event) => updateBlock(single.id, { kind: event.target.value as Block['kind'] })}
            >
              {(Object.keys(BLOCK_KIND_LABELS) as Block['kind'][]).map((kind) => (
                <option key={kind} value={kind}>
                  {BLOCK_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {activity?.notes && (
          <p className="rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
            {activity.notes}
          </p>
        )}

        {activity && (
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11.5px]">
            <Stat label="Set-up" value={formatDuration(activity.setupMin)} />
            <Stat label="Pack-down" value={formatDuration(activity.packdownMin)} />
            {activity.capacity && <Stat label="Capacity" value={`${activity.capacity} students`} />}
            {activity.minStaff > 0 && <Stat label="Staff needed" value={String(activity.minStaff)} />}
          </dl>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-1.5 border-t border-[var(--line)] px-3 py-2">
        <Button
          size="sm"
          onClick={() => updateBlocks(ids, { locked: !blocks.every((b) => b.locked) })}
        >
          {blocks.every((b) => b.locked) ? 'Unlock' : 'Lock'}
        </Button>
        <Button size="sm" onClick={() => duplicateBlocks(ids)}>
          Duplicate
        </Button>
        <Button size="sm" variant="danger" className="ml-auto" onClick={() => removeBlocks(ids)}>
          Delete
        </Button>
      </footer>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--ink-faint)]">{label}</dt>
      <dd className="tnum font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}

/** Start/end/duration fields that accept the loose time formats staff type. */
function TimeFields({
  blocks,
  onChange,
}: {
  blocks: Block[]
  onChange: (patch: Partial<Block>) => void
}) {
  const single = blocks.length === 1 ? blocks[0] : undefined
  const [startText, setStartText] = useState<string | null>(null)
  const [endText, setEndText] = useState<string | null>(null)

  const start = single ? formatTimeFull(single.startMin) : ''
  const end = single ? formatTimeFull(single.endMin) : ''
  const duration = single ? single.endMin - single.startMin : 0

  function commitStart(text: string) {
    setStartText(null)
    const parsed = parseTime(text)
    if (parsed === null || !single) return
    onChange({ startMin: parsed, endMin: parsed + duration })
  }

  function commitEnd(text: string) {
    setEndText(null)
    const parsed = parseTime(text)
    if (parsed === null || !single) return
    if (parsed <= single.startMin) return
    onChange({ endMin: parsed })
  }

  if (!single) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Shift earlier">
          <Button size="sm" className="w-full" onClick={() => shift(blocks, -15)}>
            −15 min
          </Button>
        </Field>
        <Field label="Shift later">
          <Button size="sm" className="w-full" onClick={() => shift(blocks, 15)}>
            +15 min
          </Button>
        </Field>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Start">
        <Input
          className="tnum"
          value={startText ?? start}
          onChange={(event) => setStartText(event.target.value)}
          onBlur={(event) => commitStart(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setStartText(null)
          }}
        />
      </Field>
      <Field label="End">
        <Input
          className="tnum"
          value={endText ?? end}
          onChange={(event) => setEndText(event.target.value)}
          onBlur={(event) => commitEnd(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setEndText(null)
          }}
        />
      </Field>
      <div className="col-span-2 flex items-center gap-1">
        <span className="text-[11px] text-[var(--ink-faint)]">{formatDuration(duration)}</span>
        <div className="ml-auto flex gap-1">
          {[60, 90, 120].map((minutes) => (
            <Button
              key={minutes}
              size="sm"
              variant="ghost"
              className={cx(duration === minutes && 'bg-[var(--surface-sunk)] text-[var(--ink)]')}
              onClick={() => onChange({ endMin: single.startMin + minutes })}
            >
              {minutes === 60 ? '1h' : minutes === 90 ? '1.5h' : '2h'}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Each block moves by the same delta, so this can't go through a shared patch. */
function shift(blocks: Block[], delta: number): void {
  const store = useStore.getState()
  for (const block of blocks) {
    store.updateBlock(block.id, {
      startMin: block.startMin + delta,
      endMin: block.endMin + delta,
    })
  }
}

/** Staff list ordered by who is qualified and free. */
function StaffPicker({ block, site }: { block: Block; site: Site }) {
  const doc = useStore((s) => s.doc)
  const updateBlock = useStore((s) => s.updateBlock)
  const [expanded, setExpanded] = useState(false)

  const options = useMemo(
    () => availableStaff(block, buildConflictContext(doc), site),
    [block, doc, site],
  )

  const assigned = options.filter((option) => block.staffIds.includes(option.person.id))
  const shown = expanded ? options : options.filter((o) => o.qualified && !o.busy).slice(0, 12)

  function toggle(id: string) {
    const next = block.staffIds.includes(id)
      ? block.staffIds.filter((s) => s !== id)
      : [...block.staffIds, id]
    updateBlock(block.id, { staffIds: next })
  }

  return (
    <Field label="Staff" hint="Green means signed off for this activity at this site.">
      <div className="flex flex-wrap gap-1">
        {assigned.map(({ person, qualified, busy }) => (
          <Chip
            key={person.id}
            active
            colour={qualified ? COMPETENCY_COLOURS.can_run : COMPETENCY_COLOURS.no}
            onClick={() => toggle(person.id)}
            title={busy ? 'Also rostered elsewhere at this time' : undefined}
          >
            {person.name}
            {busy ? ' ⚠' : ''}
          </Chip>
        ))}
      </div>

      <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-[var(--line)]">
        {shown.map(({ person, qualified, busy }) => (
          <button
            key={person.id}
            type="button"
            onClick={() => toggle(person.id)}
            className={cx(
              'flex w-full items-center gap-1.5 px-2 py-1 text-left text-[12px] transition-colors',
              'hover:bg-[var(--surface-sunk)]',
              block.staffIds.includes(person.id) && 'bg-[var(--brand-tint)]',
            )}
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: qualified ? COMPETENCY_COLOURS.can_run : COMPETENCY_COLOURS.wants_to_learn,
              }}
            />
            <span className="min-w-0 flex-1 truncate">{person.name}</span>
            {busy && <span className="shrink-0 text-[10px] text-[var(--warn)]">busy</span>}
          </button>
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-2 text-[11.5px] text-[var(--ink-faint)]">
            Nobody is signed off for this activity yet.
          </p>
        )}
      </div>

      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Show qualified only' : `Show all ${options.length} staff`}
      </Button>
    </Field>
  )
}
