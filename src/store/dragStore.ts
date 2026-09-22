import { create } from 'zustand'

/**
 * Drag state lives in its own store so that a drag in progress re-renders the
 * grid and the drag ghost without touching the document store (and therefore
 * without pushing anything onto the undo stack until the drag is committed).
 */

export type DragMode = 'create' | 'move' | 'resize-start' | 'resize-end'

export type DragPayload =
  | { type: 'activity'; activityId: string }
  | { type: 'routine'; routineId: string }
  | { type: 'block'; blockId: string }

export interface DropTarget {
  gridId: string
  bookingId: string
  date: string
  /** Index into the grid's group columns; -1 means "all groups". */
  groupIndex: number
  startMin: number
  endMin: number
  /** True when the pointer is over a span-all lane rather than a single column. */
  wholeSchool: boolean
}

/** Everything a grid needs to publish for the controller to resolve a drop. */
export interface GridGeometry {
  id: string
  element: HTMLElement
  bookingId: string
  date: string
  groupIds: string[]
  pxPerMinute: number
  dayStartMin: number
  dayEndMin: number
}

interface DragState {
  active: boolean
  mode: DragMode
  payload: DragPayload | null
  /** Label and colour for the floating ghost. */
  label: string
  colour: string
  /** Length of the dragged item in minutes (kept constant while moving). */
  durationMin: number
  /** Where inside the block the pointer grabbed it, in minutes. */
  grabOffsetMin: number
  pointer: { x: number; y: number }
  target: DropTarget | null
  /** Set once the pointer has moved far enough to count as a drag, not a click. */
  moved: boolean

  begin: (input: {
    mode: DragMode
    payload: DragPayload
    label: string
    colour: string
    durationMin: number
    grabOffsetMin?: number
    pointer: { x: number; y: number }
  }) => void
  setPointer: (pointer: { x: number; y: number }) => void
  setTarget: (target: DropTarget | null) => void
  markMoved: () => void
  end: () => void
}

export const useDragStore = create<DragState>((set) => ({
  active: false,
  mode: 'move',
  payload: null,
  label: '',
  colour: '#888888',
  durationMin: 90,
  grabOffsetMin: 0,
  pointer: { x: 0, y: 0 },
  target: null,
  moved: false,

  begin: ({ mode, payload, label, colour, durationMin, grabOffsetMin = 0, pointer }) =>
    set({
      active: true,
      mode,
      payload,
      label,
      colour,
      durationMin,
      grabOffsetMin,
      pointer,
      target: null,
      moved: false,
    }),

  setPointer: (pointer) => set({ pointer }),
  setTarget: (target) => set({ target }),
  markMoved: () => set({ moved: true }),
  end: () => set({ active: false, payload: null, target: null, moved: false }),
}))

// ─── grid registry ──────────────────────────────────────────────────────────

const grids = new Map<string, GridGeometry>()

export function registerGrid(geometry: GridGeometry): () => void {
  grids.set(geometry.id, geometry)
  return () => {
    grids.delete(geometry.id)
  }
}

/** Width in px of the lane at the left of each grid that means "all groups". */
export const WHOLE_SCHOOL_LANE_PX = 26

/**
 * Finds which grid the pointer is over and converts the position into a
 * `{ date, group, time }` drop target. Returns null when the pointer is outside
 * every registered grid.
 */
export function resolveTarget(
  x: number,
  y: number,
  options: { durationMin: number; grabOffsetMin: number; snapMinutes: number; fineSnap: boolean },
): DropTarget | null {
  for (const geometry of grids.values()) {
    const rect = geometry.element.getBoundingClientRect()
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue

    const { pxPerMinute, dayStartMin, dayEndMin, groupIds } = geometry
    const increment = options.fineSnap ? 5 : options.snapMinutes

    const rawMin = dayStartMin + (y - rect.top) / pxPerMinute - options.grabOffsetMin
    const snapped = Math.round(rawMin / increment) * increment
    const startMin = Math.min(
      Math.max(snapped, dayStartMin),
      dayEndMin - options.durationMin,
    )

    // Columns are evenly divided across the grid width.
    const columnWidth = rect.width / Math.max(groupIds.length, 1)
    const rawIndex = Math.floor((x - rect.left) / columnWidth)
    const groupIndex = Math.min(Math.max(rawIndex, 0), groupIds.length - 1)

    return {
      gridId: geometry.id,
      bookingId: geometry.bookingId,
      date: geometry.date,
      groupIndex,
      startMin,
      endMin: startMin + options.durationMin,
      wholeSchool: false,
    }
  }
  return null
}

/**
 * Resize variant: the column stays put and one edge follows the pointer.
 * `anchorMin` is the edge that is *not* moving.
 */
export function resolveResize(
  x: number,
  y: number,
  options: {
    mode: 'resize-start' | 'resize-end'
    anchorMin: number
    snapMinutes: number
    fineSnap: boolean
    minLengthMin: number
  },
): { startMin: number; endMin: number; gridId: string; date: string } | null {
  for (const geometry of grids.values()) {
    const rect = geometry.element.getBoundingClientRect()
    if (x < rect.left - 400 || x > rect.right + 400 || y < rect.top || y > rect.bottom) continue

    const increment = options.fineSnap ? 5 : options.snapMinutes
    const rawMin = geometry.dayStartMin + (y - rect.top) / geometry.pxPerMinute
    const snapped = Math.round(rawMin / increment) * increment
    const bounded = Math.min(Math.max(snapped, geometry.dayStartMin), geometry.dayEndMin)

    if (options.mode === 'resize-start') {
      const startMin = Math.min(bounded, options.anchorMin - options.minLengthMin)
      return { startMin, endMin: options.anchorMin, gridId: geometry.id, date: geometry.date }
    }
    const endMin = Math.max(bounded, options.anchorMin + options.minLengthMin)
    return { startMin: options.anchorMin, endMin, gridId: geometry.id, date: geometry.date }
  }
  return null
}

export function getGrid(id: string): GridGeometry | undefined {
  return grids.get(id)
}

// ─── scroller registry ──────────────────────────────────────────────────────

const scrollers = new Set<HTMLElement>()

/**
 * Marks an element as one the drag controller may scroll.
 *
 * A week of schools is wider than any screen, so picking a session up on
 * Friday has to be able to reach Monday while you are still holding it.
 */
export function registerScroller(element: HTMLElement): () => void {
  scrollers.add(element)
  return () => {
    scrollers.delete(element)
  }
}

export function eachScroller(visit: (element: HTMLElement) => void): void {
  scrollers.forEach(visit)
}
