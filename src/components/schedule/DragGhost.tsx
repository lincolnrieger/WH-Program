import { useStore } from '@/store/useStore'
import { getGrid, useDragStore } from '@/store/dragStore'
import { blockPalette } from '@/lib/colour'
import { formatDuration, formatTimeFull, weekdayShort } from '@/lib/time'

/**
 * The card that follows the cursor while dragging.
 *
 * Over a grid it says where the session is about to land — which day, which
 * school, which group, at what time. With a week of schools on screen at once
 * the in-grid preview alone isn't enough: the block you can see moving is
 * often nowhere near the pointer, and "Wed · Keithcot · Group 2" is the
 * difference between dropping it and guessing.
 */
export function DragGhost({ dark }: { dark: boolean }) {
  const { active, moved, pointer, label, colour, durationMin, target, mode } = useDragStore()
  const bookings = useStore((s) => s.doc.bookings)

  if (!active || !moved) return null
  if (mode === 'resize-start' || mode === 'resize-end') return null

  const palette = blockPalette(colour, dark)
  const detail = target ? describe(target, bookings) : null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[100] flex max-w-[240px] flex-col rounded-[6px] border px-2.5 py-1.5 shadow-[var(--shadow-lg)]"
      style={{
        left: pointer.x + 14,
        top: pointer.y + 12,
        background: palette.surface,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <span className="truncate text-[12px] font-semibold">{label}</span>
      {detail ? (
        <>
          <span className="tnum truncate text-[10.5px]" style={{ color: palette.muted }}>
            {formatTimeFull(target!.startMin)} – {formatTimeFull(target!.endMin)}
          </span>
          <span className="truncate text-[10.5px] font-medium" style={{ color: palette.muted }}>
            {detail}
          </span>
        </>
      ) : (
        <span className="tnum text-[10.5px]" style={{ color: palette.muted }}>
          {formatDuration(durationMin)} · drop on a group column
        </span>
      )}
    </div>
  )
}

/** "Wed · Keithcot Farm · Group 2", trimmed to whatever is actually known. */
function describe(
  target: NonNullable<ReturnType<typeof useDragStore.getState>['target']>,
  bookings: { id: string; schoolName: string; groups: { id: string; name: string }[] }[],
): string {
  const booking = bookings.find((b) => b.id === target.bookingId)
  const grid = getGrid(target.gridId)
  const groupId = grid?.groupIds[target.groupIndex]
  const group = booking?.groups.find((g) => g.id === groupId)

  return [weekdayShort(target.date), booking?.schoolName, group?.name]
    .filter(Boolean)
    .join(' · ')
}
