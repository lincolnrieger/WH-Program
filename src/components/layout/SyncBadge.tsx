import type { SyncState } from '@/store/sync'
import { cx } from '@/components/ui/primitives'

/**
 * Whether the plan has reached the database.
 *
 * Worth a permanent spot in the toolbar: the plan is shared now, so "has my
 * change landed?" and "am I looking at what everyone else is?" are questions
 * with real answers, and the app should offer them without being asked.
 */
export function SyncBadge({ sync, onRetry }: { sync: SyncState; onRetry: () => void }) {
  const look = {
    loading: { dot: 'bg-[var(--ink-faint)]', label: 'Loading…', tone: 'text-[var(--ink-faint)]' },
    synced: { dot: 'bg-[var(--brand)]', label: 'Saved', tone: 'text-[var(--ink-faint)]' },
    saving: { dot: 'bg-[var(--warn)]', label: 'Saving…', tone: 'text-[var(--ink-soft)]' },
    offline: { dot: 'bg-[var(--ink-faint)]', label: 'Offline', tone: 'text-[var(--ink-soft)]' },
    error: { dot: 'bg-[var(--danger)]', label: "Can't save", tone: 'text-[var(--danger)]' },
  }[sync.status]

  const needsAttention = sync.status === 'offline' || sync.status === 'error'

  const title = needsAttention
    ? [
        sync.status === 'offline'
          ? 'No connection to the database. Your changes are held in this browser and will be saved as soon as it comes back.'
          : (sync.message ?? 'The database returned an error.'),
        sync.pending > 0 ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting.` : '',
        'Click to try now.',
      ]
        .filter(Boolean)
        .join('\n')
    : sync.status === 'synced' && sync.lastSyncedAt
      ? `Everything saved to the shared database at ${new Date(sync.lastSyncedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}.`
      : 'Saving to the shared database.'

  return (
    <button
      type="button"
      onClick={onRetry}
      title={title}
      aria-live="polite"
      className={cx(
        'hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors md:inline-flex',
        needsAttention
          ? 'border-[var(--line-strong)] bg-[var(--surface-sunk)] hover:bg-[var(--surface)]'
          : 'border-transparent hover:bg-[var(--surface-sunk)]',
        look.tone,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          look.dot,
          sync.status === 'saving' && 'animate-pulse',
        )}
      />
      {look.label}
      {sync.pending > 0 && needsAttention && (
        <span className="tnum opacity-70">· {sync.pending}</span>
      )}
    </button>
  )
}
