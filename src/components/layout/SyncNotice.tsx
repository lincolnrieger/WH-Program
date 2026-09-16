import type { SyncState } from '@/store/sync'
import { Button } from '@/components/ui/primitives'

/**
 * A bar across the top when the database is answering with a problem.
 *
 * Distinct from being offline, which is ordinary and self-healing and stays in
 * the toolbar badge. This is the case where the app looks like it's working but
 * nothing is being saved — usually a deployment that hasn't had its database
 * wired up yet — and the Worker's reply says exactly what to do, so it belongs
 * on screen rather than behind a hover.
 */
export function SyncNotice({ sync, onRetry }: { sync: SyncState; onRetry: () => void }) {
  if (sync.status !== 'error') return null

  return (
    <div
      role="alert"
      className="no-print flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--danger)] bg-[var(--danger-tint)] px-3 py-1.5"
    >
      <span className="text-[12.5px] font-semibold text-[var(--danger)]">Nothing is saving</span>
      <span className="min-w-0 flex-1 text-[12px] text-[var(--ink-soft)]">
        {sync.message ?? 'The database returned an error.'}
      </span>
      {sync.pending > 0 && (
        <span className="tnum text-[11.5px] text-[var(--ink-faint)]">
          {sync.pending} change{sync.pending === 1 ? '' : 's'} waiting
        </span>
      )}
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
