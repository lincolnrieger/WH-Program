import { useEffect, useRef } from 'react'
import { ROUTINES } from '@/data/activities'
import { allActivitiesMap, useStore } from '@/store/useStore'
import {
  eachScroller, getGrid, resolveResize, resolveTarget, useDragStore,
} from '@/store/dragStore'
import type { Block } from '@/types'

const DRAG_THRESHOLD_PX = 4
const MIN_BLOCK_MIN = 15

/** How close to a scroller's edge the pointer gets before the view moves. */
const EDGE_PX = 80
/** Top speed, in pixels per frame, with the pointer right on the edge. */
const MAX_SCROLL_PX = 24

/**
 * Installs the window-level pointer handlers that drive every drag in the app:
 * dropping a new activity from the palette, moving a block, and resizing either
 * edge. Mounted once, at the app root.
 *
 * Holding Alt while dragging switches to 5-minute snapping so a session can be
 * nudged to an odd start time without changing the global snap setting.
 */
export function useDragController(): void {
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const resizeAnchorRef = useRef<number>(0)
  const fineRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    /**
     * Works out where the thing being dragged would land, from wherever the
     * pointer currently is.
     *
     * Kept separate from the pointer handler because the auto-scroll has to
     * run it too: holding still at the edge of the view moves the grid under
     * the pointer, and a preview that only updated on pointer movement would
     * sit frozen over the wrong hour while the day scrolled past it.
     */
    function resolveNow(): void {
      const drag = useDragStore.getState()
      if (!drag.active) return
      const { snapMinutes } = useStore.getState().prefs
      const { x, y } = drag.pointer

      if (drag.mode === 'resize-start' || drag.mode === 'resize-end') {
        const resized = resolveResize(x, y, {
          mode: drag.mode,
          anchorMin: resizeAnchorRef.current,
          snapMinutes,
          fineSnap: fineRef.current,
          minLengthMin: MIN_BLOCK_MIN,
        })
        if (!resized) return
        const grid = getGrid(resized.gridId)
        useDragStore.getState().setTarget({
          gridId: resized.gridId,
          bookingId: grid?.bookingId ?? '',
          date: resized.date,
          groupIndex: -1,
          startMin: resized.startMin,
          endMin: resized.endMin,
          wholeSchool: false,
        })
        return
      }

      useDragStore.getState().setTarget(
        resolveTarget(x, y, {
          durationMin: drag.durationMin,
          grabOffsetMin: drag.mode === 'move' ? drag.grabOffsetMin : drag.durationMin / 2,
          snapMinutes,
          fineSnap: fineRef.current,
        }),
      )
    }

    /** Nudges any registered scroller the pointer is pressing against. */
    function autoScroll(): void {
      const drag = useDragStore.getState()
      if (!drag.active || !drag.moved) {
        frameRef.current = null
        return
      }

      let scrolled = false
      eachScroller((element) => {
        const rect = element.getBoundingClientRect()
        const { x, y } = drag.pointer
        // Only the scroller the pointer is actually over, or dragging in one
        // view would drag every other view along with it.
        if (x < rect.left - EDGE_PX || x > rect.right + EDGE_PX) return
        if (y < rect.top - EDGE_PX || y > rect.bottom + EDGE_PX) return

        const dx = edgeSpeed(x - rect.left, rect.right - x)
        const dy = edgeSpeed(y - rect.top, rect.bottom - y)
        if (dx === 0 && dy === 0) return

        const before = { left: element.scrollLeft, top: element.scrollTop }
        element.scrollLeft += dx
        element.scrollTop += dy
        if (element.scrollLeft !== before.left || element.scrollTop !== before.top) {
          scrolled = true
        }
      })

      if (scrolled) resolveNow()
      frameRef.current = requestAnimationFrame(autoScroll)
    }

    function handleMove(event: PointerEvent): void {
      const drag = useDragStore.getState()
      if (!drag.active) return

      const origin = originRef.current
      if (origin && !drag.moved) {
        const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
        if (distance < DRAG_THRESHOLD_PX) return
        useDragStore.getState().markMoved()
      }

      event.preventDefault()
      fineRef.current = event.altKey
      useDragStore.getState().setPointer({ x: event.clientX, y: event.clientY })
      resolveNow()

      if (frameRef.current === null) frameRef.current = requestAnimationFrame(autoScroll)
    }

    function stopScrolling(): void {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    function handleUp(): void {
      stopScrolling()
      const drag = useDragStore.getState()
      if (!drag.active) return

      // A press without movement is a click, handled by the block itself.
      if (drag.moved && drag.target && drag.payload) {
        commit(drag.payload, drag.mode, drag.target)
      }

      originRef.current = null
      useDragStore.getState().end()
      document.body.classList.remove('is-dragging')
    }

    function handleCancel(): void {
      stopScrolling()
      originRef.current = null
      useDragStore.getState().end()
      document.body.classList.remove('is-dragging')
    }

    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && useDragStore.getState().active) handleCancel()
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('keydown', handleKey)
      stopScrolling()
    }
  }, [])

  // Expose the origin/anchor refs to the components that start a drag.
  useEffect(() => {
    dragHandles.setOrigin = (point) => {
      originRef.current = point
    }
    dragHandles.setResizeAnchor = (min) => {
      resizeAnchorRef.current = min
    }
  }, [])
}

/** Pixels to scroll this frame, given the pointer's distance to each edge. */
function edgeSpeed(fromStart: number, fromEnd: number): number {
  if (fromStart < EDGE_PX) return -ramp(fromStart)
  if (fromEnd < EDGE_PX) return ramp(fromEnd)
  return 0
}

function ramp(distance: number): number {
  const closeness = Math.min(1, Math.max(0, (EDGE_PX - distance) / EDGE_PX))
  return Math.ceil(closeness * closeness * MAX_SCROLL_PX)
}

/**
 * Consecutive group ids starting at `fromId`, at most `count` of them — used to
 * keep a multi-group block's width when it moves to a school with a different
 * number of groups.
 */
function takeGroupRun(
  booking: { groups: { id: string }[] },
  fromId: string | undefined,
  count: number,
): string[] {
  if (booking.groups.length === 0) return []
  const start = Math.max(
    0,
    booking.groups.findIndex((g) => g.id === fromId),
  )
  return booking.groups.slice(start, start + Math.max(count, 1)).map((g) => g.id)
}

/** Small escape hatch so block/palette components can seed the controller refs. */
export const dragHandles: {
  setOrigin: (point: { x: number; y: number }) => void
  setResizeAnchor: (min: number) => void
} = {
  setOrigin: () => {},
  setResizeAnchor: () => {},
}

function commit(
  payload: NonNullable<ReturnType<typeof useDragStore.getState>['payload']>,
  mode: string,
  target: NonNullable<ReturnType<typeof useDragStore.getState>['target']>,
): void {
  const store = useStore.getState()
  const { doc } = store
  const booking = doc.bookings.find((b) => b.id === target.bookingId)
  if (!booking) return

  const grid = getGrid(target.gridId)
  const groupIds = grid?.groupIds ?? booking.groups.map((g) => g.id)
  const targetGroupId = groupIds[target.groupIndex] ?? groupIds[0]

  if (payload.type === 'block') {
    const block = doc.blocks.find((b) => b.id === payload.blockId)
    if (!block) return

    if (mode === 'resize-start' || mode === 'resize-end') {
      store.updateBlock(block.id, { startMin: target.startMin, endMin: target.endMin })
      return
    }

    // Dropped onto a different school in the whole-site view: the block moves
    // across, and its groups have to be remapped because group ids belong to
    // the booking. A block that covered every group covers every group of the
    // new school; anything narrower lands on the column it was dropped on.
    if (block.bookingId !== booking.id) {
      const source = doc.bookings.find((b) => b.id === block.bookingId)
      const coveredWholeSchool =
        source !== undefined && block.groupIds.length >= source.groups.length

      const nextGroupIds = coveredWholeSchool
        ? booking.groups.map((g) => g.id)
        : takeGroupRun(booking, targetGroupId, block.groupIds.length)

      if (nextGroupIds.length === 0) return

      store.updateBlock(block.id, {
        bookingId: booking.id,
        date: target.date,
        startMin: target.startMin,
        endMin: target.endMin,
        groupIds: nextGroupIds,
        // The venue may not exist at the other school's site.
        venueId: booking.site === source?.site ? block.venueId : undefined,
      })
      store.select([block.id])
      return
    }

    // Blocks that span several groups keep their span; single-group blocks
    // follow the pointer into whichever column it was dropped on.
    const nextGroupIds =
      block.groupIds.length > 1 || !targetGroupId ? block.groupIds : [targetGroupId]

    store.moveBlock(block.id, {
      startMin: target.startMin,
      endMin: target.endMin,
      groupIds: nextGroupIds,
      date: target.date,
    })
    return
  }

  if (payload.type === 'activity') {
    const activity = allActivitiesMap(doc).get(payload.activityId)
    if (!activity) return

    const block: Omit<Block, 'id'> = {
      bookingId: booking.id,
      date: target.date,
      startMin: target.startMin,
      endMin: target.endMin,
      groupIds: targetGroupId ? [targetGroupId] : booking.groups.map((g) => g.id),
      kind: 'activity',
      activityId: activity.id,
      delivery: activity.deliveries[0] ?? 'staff',
      venueId: activity.venueIds[0],
    }
    const id = store.addBlock(block)
    store.select([id])
    return
  }

  if (payload.type === 'routine') {
    const routine = ROUTINES.find((r) => r.id === payload.routineId)
    if (!routine) return

    const block: Omit<Block, 'id'> = {
      bookingId: booking.id,
      date: target.date,
      startMin: target.startMin,
      endMin: target.endMin,
      groupIds: routine.wholeSchool
        ? booking.groups.map((g) => g.id)
        : targetGroupId
          ? [targetGroupId]
          : booking.groups.map((g) => g.id),
      kind: routine.kind,
      title: routine.title,
      delivery: routine.delivery ?? 'staff',
      colour: routine.colour,
    }
    const id = store.addBlock(block)
    store.select([id])
  }
}
