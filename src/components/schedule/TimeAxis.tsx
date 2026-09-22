import { useMemo } from 'react'
import { formatTime } from '@/lib/time'
import { BASE_PX_PER_MIN } from './ScheduleGrid'

export const TIME_AXIS_WIDTH = 62

/**
 * The time gutter down the left of the schedule.
 *
 * It sticks to the left edge of its scroller: a week of schools is far wider
 * than the screen, and a clock that scrolls away with the first day leaves
 * every later day unreadable.
 */
export function TimeAxis({
  dayStartMin,
  dayEndMin,
  zoom,
  headerHeight,
}: {
  dayStartMin: number
  dayEndMin: number
  zoom: number
  headerHeight: number
}) {
  const pxPerMinute = BASE_PX_PER_MIN * zoom

  // Show every half hour once there is room for it, otherwise hourly only.
  const step = pxPerMinute * 30 >= 26 ? 30 : 60

  const ticks = useMemo(() => {
    const result: number[] = []
    const first = Math.ceil(dayStartMin / step) * step
    for (let min = first; min <= dayEndMin; min += step) result.push(min)
    return result
  }, [dayStartMin, dayEndMin, step])

  return (
    <div
      className="sticky left-0 z-[60] shrink-0 border-r border-[var(--line)] bg-[var(--surface-sunk)]"
      style={{ width: TIME_AXIS_WIDTH }}
    >
      <div
        className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]"
        style={{ height: headerHeight }}
      />
      <div
        data-time-axis
        className="relative"
        style={{ height: (dayEndMin - dayStartMin) * pxPerMinute }}
      >
        {ticks.map((min) => (
          <span
            key={min}
            className="tnum absolute right-2 -translate-y-1/2 text-[10.5px] text-[var(--ink-faint)]"
            style={{
              top: (min - dayStartMin) * pxPerMinute,
              fontWeight: min % 60 === 0 ? 600 : 400,
            }}
          >
            {formatTime(min)}
          </span>
        ))}
      </div>
    </div>
  )
}
