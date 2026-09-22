import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Activity, Site } from '@/types'
import { ROUTINES } from '@/data/activities'
import { blockPalette } from '@/lib/colour'
import { formatDuration } from '@/lib/time'
import { useDragStore } from '@/store/dragStore'
import { dragHandles } from '@/hooks/useDragController'
import { Button, IconButton, Input, SectionTitle, cx } from '@/components/ui/primitives'

export interface ActivityPaletteProps {
  activities: Activity[]
  /** Activities set aside for this school, shown above the full list. */
  picked: Activity[]
  site: Site
  dark: boolean
  search: string
  onSearch: (value: string) => void
  /** Click-to-place fallback for keyboard and touch users. */
  onQuickAdd: (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => void
  canAdd: boolean
  onAddCustom: (name: string) => void
  onUnpick: (id: string) => void
  onClearPicked: () => void
}

/**
 * Source list for the grid. Items are dragged onto a group column; clicking one
 * drops it into the first free slot of the selected day instead, so the app is
 * still usable without a mouse.
 *
 * Two things sit above the full catalogue. A box for typing an activity that
 * isn't in the catalogue yet, which adds it and sets it aside; and the set-aside
 * list itself, which is what "Add to list" in the rotation dialog fills — pick
 * the activities for a school once, then drag them where you want them.
 */
export function ActivityPalette({
  activities, picked, site, dark, search, onSearch, onQuickAdd, canAdd,
  onAddCustom, onUnpick, onClearPicked,
}: ActivityPaletteProps) {
  const [draft, setDraft] = useState('')
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return activities.filter((activity) => {
      if (!activity.sites.includes(site)) return false
      if (!query) return true
      return (
        activity.name.toLowerCase().includes(query) ||
        (activity.notes?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [activities, site, query])

  const routines = useMemo(
    () => ROUTINES.filter((r) => !query || r.title.toLowerCase().includes(query)),
    [query],
  )

  function submitCustom() {
    const name = draft.trim()
    if (!name) return
    onAddCustom(name)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-1.5 border-b border-[var(--line)] px-3 py-2.5">
        <div className="flex gap-1.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitCustom()
              }
            }}
            placeholder="Add a custom activity…"
            aria-label="Add a custom activity"
          />
          <Button size="md" variant="primary" disabled={!draft.trim()} onClick={submitCustom}>
            Add
          </Button>
        </div>
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search activities…"
          aria-label="Search activities"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {picked.length > 0 && (
          <>
            <SectionTitle
              right={
                <Button size="sm" variant="ghost" onClick={onClearPicked}>
                  Clear
                </Button>
              }
            >
              Picked ({picked.length})
            </SectionTitle>
            <div className="flex flex-col gap-1 px-2">
              {picked.map((activity) => (
                <PaletteItem
                  key={activity.id}
                  name={activity.name}
                  colour={activity.colour}
                  meta={formatDuration(activity.defaultDurationMin)}
                  note={activity.notes}
                  dark={dark}
                  canAdd={canAdd}
                  onRemove={() => onUnpick(activity.id)}
                  onBegin={(event) =>
                    beginDrag(event, {
                      payload: { type: 'activity', activityId: activity.id },
                      label: activity.name,
                      colour: activity.colour,
                      durationMin: activity.defaultDurationMin,
                    })
                  }
                  onQuickAdd={() => onQuickAdd({ type: 'activity', id: activity.id })}
                />
              ))}
            </div>
            <p className="px-3 pt-1.5 text-[10.5px] leading-snug text-[var(--ink-faint)]">
              Drag these onto the grid, or click one to drop it in the next free slot.
            </p>
          </>
        )}

        <SectionTitle>All activities ({filtered.length})</SectionTitle>
        <div className="flex flex-col gap-1 px-2">
          {filtered.map((activity) => (
            <PaletteItem
              key={activity.id}
              name={activity.name}
              colour={activity.colour}
              meta={formatDuration(activity.defaultDurationMin)}
              note={activity.notes}
              dark={dark}
              canAdd={canAdd}
              onBegin={(event) =>
                beginDrag(event, {
                  payload: { type: 'activity', activityId: activity.id },
                  label: activity.name,
                  colour: activity.colour,
                  durationMin: activity.defaultDurationMin,
                })
              }
              onQuickAdd={() => onQuickAdd({ type: 'activity', id: activity.id })}
            />
          ))}
          {filtered.length === 0 && (
            <p className="px-1 py-3 text-[12px] text-[var(--ink-faint)]">
              No activities match “{search}”.
            </p>
          )}
        </div>

        <SectionTitle>Meals &amp; logistics</SectionTitle>
        <div className="flex flex-col gap-1 px-2">
          {routines.map((routine) => (
            <PaletteItem
              key={routine.id}
              name={routine.title.replace(/\n/g, ' · ')}
              colour={routine.colour}
              meta={`${formatDuration(routine.durationMin)}${routine.wholeSchool ? ' · whole school' : ''}`}
              dark={dark}
              canAdd={canAdd}
              onBegin={(event) =>
                beginDrag(event, {
                  payload: { type: 'routine', routineId: routine.id },
                  label: routine.title.replace(/\n/g, ' · '),
                  colour: routine.colour,
                  durationMin: routine.durationMin,
                })
              }
              onQuickAdd={() => onQuickAdd({ type: 'routine', id: routine.id })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface BeginDragInput {
  payload: { type: 'activity'; activityId: string } | { type: 'routine'; routineId: string }
  label: string
  colour: string
  durationMin: number
}

function beginDrag(event: ReactPointerEvent<HTMLElement>, input: BeginDragInput): void {
  if (event.button !== 0) return

  dragHandles.setOrigin({ x: event.clientX, y: event.clientY })
  useDragStore.getState().begin({
    mode: 'create',
    payload: input.payload,
    label: input.label,
    colour: input.colour,
    durationMin: input.durationMin,
    pointer: { x: event.clientX, y: event.clientY },
  })
  document.body.classList.add('is-dragging')
}

function PaletteItem({
  name, colour, meta, note, dark, canAdd, onBegin, onQuickAdd, onRemove,
}: {
  name: string
  colour: string
  meta: string
  note?: string
  dark: boolean
  canAdd: boolean
  onBegin: (event: ReactPointerEvent<HTMLElement>) => void
  onQuickAdd: () => void
  /** Present on the picked list, where an item can be put back. */
  onRemove?: () => void
}) {
  const palette = blockPalette(colour, dark)

  return (
    <div
      role="button"
      tabIndex={0}
      title={note ? `${name}\n\n${note}` : name}
      onPointerDown={(event) => {
        if (!canAdd) return
        onBegin(event)
      }}
      onClick={() => {
        if (!canAdd || useDragStore.getState().moved) return
        onQuickAdd()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (canAdd) onQuickAdd()
        }
      }}
      className={cx(
        'group relative flex cursor-grab items-center gap-2 overflow-hidden rounded-md border py-1.5 pr-1 pl-2.5',
        'transition-shadow hover:shadow-[var(--shadow-sm)]',
        !canAdd && 'cursor-not-allowed opacity-50',
      )}
      style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: palette.rail }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] leading-[15px] font-semibold">{name}</span>
        <span className="tnum block truncate text-[10.5px]" style={{ color: palette.muted }}>
          {meta}
        </span>
      </span>
      {note && !onRemove && (
        <span
          aria-hidden
          className="shrink-0 pr-1 text-[10px] opacity-50 transition-opacity group-hover:opacity-90"
          title={note}
        >
          &#9432;
        </span>
      )}
      {onRemove && (
        <IconButton
          label={`Take ${name} off the picked list`}
          className="h-5 w-5 shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
        >
          &#10005;
        </IconButton>
      )}
    </div>
  )
}
