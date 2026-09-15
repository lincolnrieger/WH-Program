import { useEffect, useRef } from 'react'
import { ROUTINES } from '@/data/activities'
import { allActivitiesMap, useStore } from '@/store/useStore'
import {
  getGrid, resolveResize, resolveTarget, useDragStore,
} from '@/store/dragStore'
import type { Block } from '@/types'

const DRAG_THRESHOLD_PX = 4
const MIN_BLOCK_MIN = 15

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

  useEffect(() => {
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
      const { snapMinutes } = useStore.getState().prefs
      const fineSnap = event.altKey

      useDragStore.getState().setPointer({ x: event.clientX, y: event.clientY })

      if (drag.mode === 'resize-start' || drag.mode === 'resize-end') {
        const resized = resolveResize(event.clientX, event.clientY, {
          mode: drag.mode,
          anchorMin: resizeAnchorRef.current,
          snapMinutes,
          fineSnap,
          minLengthMin: MIN_BLOCK_MIN,
        })
        if (resized) {
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
        }
        return
      }

      const target = resolveTarget(event.clientX, event.clientY, {
        durationMin: drag.durationMin,
        grabOffsetMin: drag.mode === 'move' ? drag.grabOffsetMin : drag.durationMin / 2,
        snapMinutes,
        fineSnap,
      })
      useDragStore.getState().setTarget(target)
    }

    function handleUp(): void {
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
      staffIds: [],
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
      delivery: 'staff',
      staffIds: [],
      colour: routine.colour,
    }
    const id = store.addBlock(block)
    store.select([id])
  }
}
