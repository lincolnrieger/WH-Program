import { useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import type { Activity, Site } from '@/types'
import { ROUTINES } from '@/data/activities'
import { blockPalette } from '@/lib/colour'
import { formatDuration } from '@/lib/time'
import { useDragStore } from '@/store/dragStore'
import { dragHandles } from '@/hooks/useDragController'
import { Input, SectionTitle, cx } from '@/components/ui/primitives'

export interface ActivityPaletteProps {
  activities: Activity[]
  site: Site
  dark: boolean
  search: string
  onSearch: (value: string) => void
  /** Click-to-place fallback for keyboard and touch users. */
  onQuickAdd: (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => void
  canAdd: boolean
}

/**
 * Source list for the grid. Items are dragged onto a group column; clicking one
 * drops it into the first free slot of the selected day instead, so the app is
 * still usable without a mouse.
 */
export function ActivityPalette({
  activities, site, dark, search, onSearch, onQuickAdd, canAdd,
}: ActivityPaletteProps) {
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pt-3">
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search activities…"
          aria-label="Search activities"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <SectionTitle>Activities ({filtered.length})</SectionTitle>
        <div className="flex flex-col gap-1 px-2">
          {filtered.map((activity) => (
            <PaletteItem
              key={activity.id}
              name={activity.name}
              colour={activity.colour}
              meta={`${formatDuration(activity.defaultDurationMin)}${
                activity.minStaff > 0 ? ` · ${activity.minStaff} staff` : ''
              }`}
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
  name, colour, meta, note, dark, canAdd, onBegin, onQuickAdd,
}: {
  name: string
  colour: string
  meta: string
  note?: string
  dark: boolean
  canAdd: boolean
  onBegin: (event: ReactPointerEvent<HTMLElement>) => void
  onQuickAdd: () => void
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
        'group relative flex cursor-grab items-center gap-2 overflow-hidden rounded-md border py-1.5 pr-2 pl-2.5',
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
      {note && (
        <span
          aria-hidden
          className="shrink-0 text-[10px] opacity-50 transition-opacity group-hover:opacity-90"
          title={note}
        >
          &#9432;
        </span>
      )}
    </div>
  )
}
