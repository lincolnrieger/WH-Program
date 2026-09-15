import type { CompetencyLevel } from '@/types'
import { COMPETENCY_COLOURS, COMPETENCY_LABELS, COMPETENCY_SHORT } from '@/types'
import { readableText } from '@/lib/colour'
import { cx } from '@/components/ui/primitives'

/** The levels offered in the UI, in the order the training legend lists them. */
export const PICKABLE_LEVELS: CompetencyLevel[] = [
  'trainer',
  'can_run',
  'can_run_elsewhere',
  'in_training',
  'wants_to_learn',
  'no',
]

/** Segmented control for setting one person's competency in one activity. */
export function LevelPicker({
  value,
  onChange,
  edited,
  size = 'md',
}: {
  value: CompetencyLevel
  onChange: (level: CompetencyLevel | null) => void
  /** True when this came from an in-app edit rather than the workbook. */
  edited?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex rounded-md border border-[var(--line)] p-0.5">
        {PICKABLE_LEVELS.map((level) => {
          const active = value === level
          const colour = COMPETENCY_COLOURS[level]
          return (
            <button
              key={level}
              type="button"
              title={COMPETENCY_LABELS[level]}
              aria-label={COMPETENCY_LABELS[level]}
              aria-pressed={active}
              onClick={() => onChange(active ? null : level)}
              className={cx(
                'rounded font-semibold transition-all',
                size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-6 w-7 text-[11px]',
                !active && 'text-[var(--ink-faint)] hover:bg-[var(--surface-sunk)]',
              )}
              style={active ? { background: colour, color: readableText(colour) } : undefined}
            >
              {COMPETENCY_SHORT[level] || '·'}
            </button>
          )
        })}
      </div>
      {edited && (
        <span
          title="Set here, overriding the training workbook"
          className="text-[9px] text-[var(--brand)]"
          aria-label="Edited"
        >
          &#9679;
        </span>
      )}
    </div>
  )
}

/** Key explaining the single-letter badges. */
export function LevelLegend({ className }: { className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {PICKABLE_LEVELS.map((level) => (
        <span key={level} className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold"
            style={{
              background: COMPETENCY_COLOURS[level],
              color: readableText(COMPETENCY_COLOURS[level]),
            }}
          >
            {COMPETENCY_SHORT[level] || '·'}
          </span>
          {COMPETENCY_LABELS[level]}
        </span>
      ))}
    </div>
  )
}
