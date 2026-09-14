import { useMemo, useState } from 'react'
import type { Issue, IssueSeverity } from '@/types'
import { formatDate } from '@/lib/time'
import { cx } from '@/components/ui/primitives'

const SEVERITY_ORDER: IssueSeverity[] = ['error', 'warning', 'info']

const SEVERITY_STYLE: Record<IssueSeverity, { dot: string; label: string }> = {
  error: { dot: 'var(--danger)', label: 'Clash' },
  warning: { dot: 'var(--warn)', label: 'Check' },
  info: { dot: 'var(--info)', label: 'Note' },
}

/** Live list of everything the scheduling rules have flagged. */
export function ConflictPanel({
  issues,
  onFocus,
}: {
  issues: Issue[]
  onFocus: (issue: Issue) => void
}) {
  const [filter, setFilter] = useState<IssueSeverity | 'all'>('all')

  const counts = useMemo(() => {
    const result: Record<IssueSeverity, number> = { error: 0, warning: 0, info: 0 }
    for (const issue of issues) result[issue.severity] += 1
    return result
  }, [issues])

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? issues : issues.filter((i) => i.severity === filter)
    return [...filtered].sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        a.date.localeCompare(b.date),
    )
  }, [issues, filter])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 px-3 pt-3 pb-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All {issues.length}
        </FilterPill>
        {SEVERITY_ORDER.map((severity) => (
          <FilterPill
            key={severity}
            active={filter === severity}
            onClick={() => setFilter(severity)}
            dot={SEVERITY_STYLE[severity].dot}
          >
            {counts[severity]}
          </FilterPill>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-[var(--ink-faint)]">
            {issues.length === 0
              ? 'No clashes — the week is clean.'
              : 'Nothing in this category.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() => onFocus(issue)}
                  className="flex w-full gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
                >
                  <span
                    aria-hidden
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_STYLE[issue.severity].dot }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] leading-snug text-[var(--ink)]">
                      {issue.message}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-[var(--ink-faint)]">
                      {formatDate(issue.date)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FilterPill({
  children, active, onClick, dot,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  dot?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'tnum inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
      )}
    >
      {dot && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  )
}
