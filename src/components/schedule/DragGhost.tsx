import { useDragStore } from '@/store/dragStore'
import { blockPalette } from '@/lib/colour'
import { formatDuration } from '@/lib/time'

/**
 * The card that follows the cursor while dragging. It only appears when there
 * is no valid drop target, so on-grid dragging is guided by the in-grid preview
 * instead of two competing ghosts.
 */
export function DragGhost({ dark }: { dark: boolean }) {
  const { active, moved, pointer, label, colour, durationMin, target, mode } = useDragStore()
  if (!active || !moved || target || mode !== 'create') return null

  const palette = blockPalette(colour, dark)

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[100] flex max-w-[220px] flex-col rounded-[6px] border px-2.5 py-1.5 shadow-[var(--shadow-lg)]"
      style={{
        left: pointer.x + 14,
        top: pointer.y + 12,
        background: palette.surface,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <span className="truncate text-[12px] font-semibold">{label}</span>
      <span className="tnum text-[10.5px]" style={{ color: palette.muted }}>
        {formatDuration(durationMin)} · drop on a group column
      </span>
    </div>
  )
}
