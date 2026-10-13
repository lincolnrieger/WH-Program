import { useMemo, useState } from 'react'
import type { Activity, Block, Booking, Site, Venue } from '@/types'
import { BLOCK_KIND_LABELS, DELIVERY_LABELS } from '@/types'
import { formatDuration, formatTimeFull, parseTime } from '@/lib/time'
import { blockTitle } from '@/lib/exportImport'
import { useStore } from '@/store/useStore'
import { Button, Chip, Field, IconButton, Input, Select, cx } from '@/components/ui/primitives'

export interface InspectorProps {
  blocks: Block[]
  booking: Booking | undefined
  activities: Map<string, Activity>
  venues: Venue[]
  site: Site
  onClose: () => void
  /** Deletes the blocks; the app owns this so it can offer an undo. */
  onRemove: (ids: string[]) => void
}

/**
 * Edits whatever is currently selected. Multi-selection edits the fields that
 * make sense in bulk (time, delivery, venue) and leaves the rest alone.
 *
 * Fields run in the order the questions get asked: what is it, when, who,
 * how it's run and where — then the notes.
 */
export function Inspector({
  blocks, booking, activities, venues, site, onClose, onRemove,
}: InspectorProps) {
  const updateBlock = useStore((s) => s.updateBlock)
  const updateBlocks = useStore((s) => s.updateBlocks)
  const duplicateBlocks = useStore((s) => s.duplicateBlocks)

  const single = blocks.length === 1 ? blocks[0] : undefined
  const ids = blocks.map((b) => b.id)
  const activity = single?.activityId ? activities.get(single.activityId) : undefined

  const siteVenues = useMemo(() => venues.filter((v) => v.sites.includes(site)), [venues, site])
  const siteActivities = useMemo(
    () =>
      [...activities.values()]
        .filter((a) => a.sites.includes(site) || a.id === single?.activityId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activities, site, single?.activityId],
  )

  /**
   * Swapping one activity for another keeps the slot and the groups but takes
   * the new activity's name and, unless a venue was chosen by hand, its venue.
   */
  function swapActivity(block: Block, nextId: string) {
    const next = activities.get(nextId)
    if (!next) return
    const previous = block.activityId ? activities.get(block.activityId) : undefined
    const venueWasDefault = !block.venueId || (previous?.venueIds.includes(block.venueId) ?? false)
    const titleWasDefault = !block.title || block.title === previous?.name
    updateBlock(block.id, {
      activityId: next.id,
      title: titleWasDefault ? undefined : block.title,
      venueId: venueWasDefault ? next.venueIds[0] : block.venueId,
      delivery: next.deliveries.includes(block.delivery) ? block.delivery : (next.deliveries[0] ?? 'staff'),
    })
  }

  if (blocks.length === 0) return null

  return (
    <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <h2 className="truncate text-[13px] font-semibold">
          {single ? blockTitle(single, activity) : `${blocks.length} sessions selected`}
        </h2>
        <IconButton label="Close (Esc)" onClick={onClose}>
          &#10005;
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {single && single.kind === 'activity' && (
          <Field label="Activity">
            <Select
              value={single.activityId ?? ''}
              onChange={(event) => swapActivity(single, event.target.value)}
            >
              {!single.activityId && <option value="">Choose an activity</option>}
              {siteActivities.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {single && (
          <Field
            label={single.kind === 'activity' ? 'Title on the itinerary' : 'Title'}
            hint={
              single.kind === 'activity'
                ? 'Change it only if the sheet should say something else.'
                : 'Press Enter for a second line, e.g. “Breakfast / Pack bags”.'
            }
          >
            <textarea
              value={single.title ?? activity?.name ?? ''}
              placeholder={activity?.name ?? 'Block title'}
              rows={2}
              onChange={(event) =>
                updateBlock(single.id, { title: event.target.value || undefined }, `title:${single.id}`)
              }
              className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-soft)] focus:outline-none"
            />
          </Field>
        )}

        <TimeFields blocks={blocks} onChange={(patch) => updateBlocks(ids, patch)} />

        {booking && single && (
          <Field label="Groups" hint="Pick more than one to run it across those columns.">
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
              {booking.groups.length > 1 && (
                <Chip onClick={() => updateBlock(single.id, { groupIds: booking.groups.map((g) => g.id) })}>
                  Whole school
                </Chip>
              )}
            </div>
          </Field>
        )}

        <Field label="Run by" hint="Teacher led prints as “- TL”, self led as “- Self Led”.">
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

        {single && (
          <Field label="Note">
            <textarea
              value={single.note ?? ''}
              onChange={(event) =>
                updateBlock(single.id, { note: event.target.value || undefined }, `note:${single.id}`)
              }
              rows={2}
              placeholder="Anything worth writing on the itinerary…"
              className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-soft)] focus:outline-none"
            />
          </Field>
        )}

        {activity?.notes && (
          <p className="rounded-md bg-[var(--surface-sunk)] px-2 py-1.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
            {activity.notes}
          </p>
        )}

        {single && (
          <Field label="Kind of block" hint="Sets how it’s coloured and printed.">
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
      </div>

      <footer className="flex shrink-0 items-center gap-1.5 border-t border-[var(--line)] px-3 py-2">
        <Button
          size="sm"
          title="A locked block can't be dragged by accident"
          onClick={() => updateBlocks(ids, { locked: !blocks.every((b) => b.locked) })}
        >
          {blocks.every((b) => b.locked) ? 'Unlock' : 'Lock'}
        </Button>
        <Button size="sm" title="Duplicate (Ctrl+D)" onClick={() => duplicateBlocks(ids)}>
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="ml-auto"
          title="Delete (Del)"
          onClick={() => onRemove(ids)}
        >
          Delete
        </Button>
      </footer>
    </aside>
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

/** Each block moves by the same delta — one patch per block, one undo for all. */
function shift(blocks: Block[], delta: number): void {
  useStore.getState().updateEach(
    blocks.map((b) => b.id),
    (block) => (block.locked ? null : { startMin: block.startMin + delta, endMin: block.endMin + delta }),
  )
}
