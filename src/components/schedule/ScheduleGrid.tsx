import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Activity, Block, Booking } from '@/types'
import { layoutBlocks } from '@/lib/layout'
import { formatTimeFull } from '@/lib/time'
import { blockPalette } from '@/lib/colour'
import { registerGrid, useDragStore } from '@/store/dragStore'
import { BlockCard } from './BlockCard'
import { cx } from '@/components/ui/primitives'

export const BASE_PX_PER_MIN = 1

export interface ScheduleGridProps {
  gridId: string
  booking: Booking
  date: string
  blocks: Block[]
  activities: Map<string, Activity>
  venueNames: Map<string, string>
  selection: string[]
  highlightIds: string[]
  dayStartMin: number
  dayEndMin: number
  zoom: number
  dark: boolean
  /** Show the venue on blocks tall enough for it. */
  showDetail: boolean
  onSelect: (blockId: string, additive: boolean) => void
  onBackgroundClick: () => void
  /** Click on empty grid space — used to create a block at that time. */
  onEmptyDoubleClick?: (groupIndex: number, startMin: number) => void
  /** Compact mode drops the group header row (used inside the week view). */
  compact?: boolean
}

/**
 * The time grid for one school on one day: a column per group, blocks laid out
 * against a time axis, with a live preview of whatever is currently being
 * dragged over it.
 */
export function ScheduleGrid({
  gridId, booking, date, blocks, activities, venueNames,
  selection, highlightIds, dayStartMin, dayEndMin, zoom, dark, showDetail,
  onSelect, onBackgroundClick, onEmptyDoubleClick, compact = false,
}: ScheduleGridProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const pxPerMinute = BASE_PX_PER_MIN * zoom
  const totalMinutes = dayEndMin - dayStartMin
  const height = totalMinutes * pxPerMinute

  const groupIds = useMemo(() => booking.groups.map((g) => g.id), [booking.groups])

  // Publish geometry so the drag controller can resolve drops onto this grid.
  useLayoutEffect(() => {
    const element = canvasRef.current
    if (!element) return
    return registerGrid({
      id: gridId,
      element,
      bookingId: booking.id,
      date,
      groupIds,
      pxPerMinute,
      dayStartMin,
      dayEndMin,
    })
  }, [gridId, booking.id, date, groupIds, pxPerMinute, dayStartMin, dayEndMin])

  const positioned = useMemo(() => layoutBlocks(blocks, groupIds), [blocks, groupIds])

  const columns = Math.max(groupIds.length, 1)
  const columnPercent = 100 / columns

  function columnStyle(startCol: number, endCol: number, lane: number, lanes: number) {
    const spanStart = startCol * columnPercent
    const spanWidth = (endCol - startCol + 1) * columnPercent
    const laneWidth = spanWidth / lanes
    return {
      left: `calc(${spanStart + laneWidth * lane}% + 3px)`,
      width: `calc(${laneWidth}% - 6px)`,
    }
  }

  // Whole-school bands sit behind, so a group's own block stays readable and
  // clickable when the two overlap.
  const layerZ = { band: 5, block: 10 } as const

  return (
    <div className="flex min-w-0 flex-col">
      {!compact && (
        <div
          className="sticky top-0 z-30 grid border-b border-[var(--line)] bg-[var(--surface)]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {booking.groups.map((group) => (
            <div
              key={group.id}
              className="truncate border-l border-[var(--line)] px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--ink-soft)] first:border-l-0"
            >
              {group.name}
              {group.size ? (
                <span className="tnum ml-1 font-normal text-[var(--ink-faint)]">{group.size}</span>
              ) : null}
            </div>
          ))}
          {booking.groups.length === 0 && (
            <div className="px-2 py-1.5 text-center text-[11px] text-[var(--ink-faint)]">
              No groups yet
            </div>
          )}
        </div>
      )}

      <div
        ref={canvasRef}
        /* Height is set explicitly from the zoom level — no flex sizing here, or
           flex-basis collapses the canvas to 0px and drop targets stop resolving. */
        className="relative w-full shrink-0"
        style={{ height }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onBackgroundClick()
        }}
        onDoubleClick={(event) => {
          if (event.target !== event.currentTarget || !onEmptyDoubleClick) return
          const rect = event.currentTarget.getBoundingClientRect()
          const minute = dayStartMin + (event.clientY - rect.top) / pxPerMinute
          const groupIndex = Math.min(
            Math.floor((event.clientX - rect.left) / (rect.width / columns)),
            columns - 1,
          )
          onEmptyDoubleClick(Math.max(groupIndex, 0), Math.round(minute / 15) * 15)
        }}
      >
        <GridLines
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          pxPerMinute={pxPerMinute}
          columns={columns}
        />

        {positioned.map(({ block, startCol, endCol, lane, lanes, layer }) => {
          const geometry = columnStyle(startCol, endCol, lane, lanes)
          return (
            <BlockCard
              key={block.id}
              baseZ={layerZ[layer]}
              block={block}
              activity={block.activityId ? activities.get(block.activityId) : undefined}
              top={(block.startMin - dayStartMin) * pxPerMinute}
              height={(block.endMin - block.startMin) * pxPerMinute}
              left={geometry.left}
              width={geometry.width}
              dark={dark}
              selected={selection.includes(block.id)}
              highlighted={highlightIds.includes(block.id)}
              venueName={showDetail && block.venueId ? venueNames.get(block.venueId) : undefined}
              onSelect={onSelect}
            />
          )
        })}

        <DropPreview
          gridId={gridId}
          dayStartMin={dayStartMin}
          pxPerMinute={pxPerMinute}
          columns={columns}
          dark={dark}
        />

        <NowLine dayStartMin={dayStartMin} dayEndMin={dayEndMin} pxPerMinute={pxPerMinute} date={date} />
      </div>
    </div>
  )
}

function GridLines({
  dayStartMin, dayEndMin, pxPerMinute, columns,
}: {
  dayStartMin: number
  dayEndMin: number
  pxPerMinute: number
  columns: number
}) {
  const lines = useMemo(() => {
    const result: { min: number; hour: boolean }[] = []
    const firstHalfHour = Math.ceil(dayStartMin / 30) * 30
    for (let min = firstHalfHour; min <= dayEndMin; min += 30) {
      result.push({ min, hour: min % 60 === 0 })
    }
    return result
  }, [dayStartMin, dayEndMin])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {lines.map(({ min, hour }) => (
        <span
          key={min}
          className={cx(
            'absolute inset-x-0 border-t',
            hour ? 'border-[var(--line)]' : 'border-[var(--line)] opacity-40',
          )}
          style={{ top: (min - dayStartMin) * pxPerMinute }}
        />
      ))}
      {Array.from({ length: Math.max(columns - 1, 0) }, (_, index) => (
        <span
          key={index}
          className="absolute inset-y-0 border-l border-[var(--line)] opacity-70"
          style={{ left: `${((index + 1) * 100) / columns}%` }}
        />
      ))}
    </div>
  )
}

/** Ghost of the item being dragged, drawn where it would land. */
function DropPreview({
  gridId, dayStartMin, pxPerMinute, columns, dark,
}: {
  gridId: string
  dayStartMin: number
  pxPerMinute: number
  columns: number
  dark: boolean
}) {
  const { active, target, label, colour, moved, mode } = useDragStore()
  if (!active || !moved || !target || target.gridId !== gridId) return null

  const palette = blockPalette(colour, dark)
  const columnPercent = 100 / columns
  const isResize = mode === 'resize-start' || mode === 'resize-end'

  // A resize keeps the block in its own column; the preview spans the full
  // width instead of guessing, since the column isn't changing.
  const left = isResize ? '3px' : `calc(${target.groupIndex * columnPercent}% + 3px)`
  const width = isResize ? 'calc(100% - 6px)' : `calc(${columnPercent}% - 6px)`

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-40 flex flex-col justify-start overflow-hidden rounded-[6px] border-2 border-dashed px-2 py-1"
      style={{
        top: (target.startMin - dayStartMin) * pxPerMinute,
        height: Math.max((target.endMin - target.startMin) * pxPerMinute, 18),
        left,
        width,
        background: `color-mix(in srgb, ${palette.surface} 80%, transparent)`,
        borderColor: palette.rail,
        color: palette.text,
      }}
    >
      <span className="truncate text-[11px] font-semibold">{label}</span>
      <span className="tnum text-[10.5px]" style={{ color: palette.muted }}>
        {formatTimeFull(target.startMin)} – {formatTimeFull(target.endMin)}
      </span>
    </div>
  )
}

/** Red line at the current time, only on today's column. */
function NowLine({
  dayStartMin, dayEndMin, pxPerMinute, date,
}: {
  dayStartMin: number
  dayEndMin: number
  pxPerMinute: number
  date: string
}) {
  const [now, setNow] = useState(() => currentMinutes())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(currentMinutes()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const today = new Date()
  const isToday =
    date ===
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  if (!isToday || now < dayStartMin || now > dayEndMin) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-30"
      style={{ top: (now - dayStartMin) * pxPerMinute }}
    >
      <span className="block h-px w-full bg-[var(--danger)] opacity-70" />
      <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-[var(--danger)]" />
    </div>
  )
}

function currentMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}
