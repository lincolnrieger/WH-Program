import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import type { Activity, Block } from '@/types'
import { blockPalette, colourFromString } from '@/lib/colour'
import { blockTitle } from '@/lib/exportImport'
import { formatRange } from '@/lib/time'
import { dragHandles } from '@/hooks/useDragController'
import { useDragStore } from '@/store/dragStore'
import { cx } from '@/components/ui/primitives'

const RESIZE_HANDLE_PX = 7

export interface BlockCardProps {
  block: Block
  activity?: Activity
  /** Pixel geometry computed by the grid. */
  top: number
  height: number
  left: string
  width: string
  dark: boolean
  selected: boolean
  highlighted: boolean
  venueName?: string
  /** Off hides the time range, for planners who read the axis instead. */
  showTimes?: boolean
  /** Stacking order for this block's layer — bands sit behind per-group blocks. */
  baseZ: number
  onSelect: (blockId: string, additive: boolean) => void
}

/**
 * One scheduled item on the grid.
 *
 * The whole card is a drag handle; the top and bottom 7px resize instead. A
 * press that doesn't move is treated as a click, so selecting and dragging
 * share the same gesture without a modifier key.
 */
export const BlockCard = memo(function BlockCard({
  block, activity, top, height, left, width, dark, selected, highlighted,
  venueName, showTimes = true, baseZ, onSelect,
}: BlockCardProps) {
  const colour = block.colour ?? activity?.colour ?? colourFromString(block.title ?? block.id)
  const palette = useMemo(() => blockPalette(colour, dark), [colour, dark])

  const title = blockTitle(block, activity)

  const compact = height < 46
  const roomy = height >= 74

  function startDrag(event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize-start' | 'resize-end') {
    if (event.button !== 0) return
    if (block.locked && mode !== 'move') return
    event.stopPropagation()

    dragHandles.setOrigin({ x: event.clientX, y: event.clientY })

    if (mode === 'move') {
      const rect = event.currentTarget.getBoundingClientRect()
      const grabFraction = (event.clientY - rect.top) / Math.max(rect.height, 1)
      const duration = block.endMin - block.startMin
      useDragStore.getState().begin({
        mode: 'move',
        payload: { type: 'block', blockId: block.id },
        label: title,
        colour,
        durationMin: duration,
        grabOffsetMin: grabFraction * duration,
        pointer: { x: event.clientX, y: event.clientY },
      })
    } else {
      dragHandles.setResizeAnchor(mode === 'resize-start' ? block.endMin : block.startMin)
      useDragStore.getState().begin({
        mode,
        payload: { type: 'block', blockId: block.id },
        label: title,
        colour,
        durationMin: block.endMin - block.startMin,
        pointer: { x: event.clientX, y: event.clientY },
      })
    }
    document.body.classList.add('is-dragging')
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${title}, ${formatRange(block.startMin, block.endMin)}`}
      data-block-id={block.id}
      onPointerDown={(event) => {
        if (block.locked) {
          onSelect(block.id, event.shiftKey)
          return
        }
        startDrag(event, 'move')
      }}
      onClick={(event) => {
        // Fires only when the press didn't turn into a drag.
        if (useDragStore.getState().moved) return
        onSelect(block.id, event.shiftKey || event.metaKey || event.ctrlKey)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(block.id, event.shiftKey)
        }
      }}
      className={cx(
        'group absolute overflow-hidden rounded-[6px] border text-left',
        'transition-[box-shadow,transform] duration-100',
        block.locked ? 'cursor-default' : 'cursor-grab',
        selected ? 'shadow-[var(--shadow-md)]' : 'hover:shadow-[var(--shadow-sm)]',
        highlighted && 'flash',
      )}
      style={{
        zIndex: selected ? 30 : baseZ,
        top,
        height: Math.max(height, 18),
        left,
        width,
        background: palette.surface,
        borderColor: selected ? 'var(--brand)' : palette.border,
        borderWidth: selected ? 2 : 1,
        color: palette.text,
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--brand) 30%, transparent)' : undefined,
      }}
    >
      {/* Saturated rail keeps the original spreadsheet colour recognisable. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: palette.rail }}
      />

      <div className={cx('flex h-full flex-col gap-0.5 pr-1.5 pl-2.5', compact ? 'py-0.5' : 'py-1')}>
        <div className="flex items-start gap-1">
          <span
            className={cx(
              'min-w-0 flex-1 font-semibold',
              compact ? 'truncate text-[11px] leading-[14px]' : 'text-[12px] leading-[15px]',
            )}
            style={{ whiteSpace: compact ? 'nowrap' : 'pre-line' }}
          >
            {title}
          </span>
          {block.locked && (
            <span aria-label="Locked" title="Locked" className="mt-px shrink-0 text-[10px] opacity-60">
              &#128274;
            </span>
          )}
        </div>

        {!compact && showTimes && (
          <span className="tnum text-[10.5px] leading-[13px]" style={{ color: palette.muted }}>
            {formatRange(block.startMin, block.endMin)}
          </span>
        )}

        {roomy && venueName && (
          <span className="truncate text-[10.5px] leading-[13px]" style={{ color: palette.muted }}>
            {venueName}
          </span>
        )}
      </div>

      {!block.locked && (
        <>
          <span
            onPointerDown={(event) => startDrag(event, 'resize-start')}
            className="absolute inset-x-0 top-0 cursor-ns-resize"
            style={{ height: RESIZE_HANDLE_PX }}
            aria-hidden
          />
          <span
            onPointerDown={(event) => startDrag(event, 'resize-end')}
            className="absolute inset-x-0 bottom-0 cursor-ns-resize"
            style={{ height: RESIZE_HANDLE_PX }}
            aria-hidden
          />
          {/* Grip line, visible on hover, so the resize affordance is discoverable. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-[2px] mx-auto h-[2px] w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-60"
            style={{ background: palette.rail }}
          />
        </>
      )}
    </article>
  )
})
