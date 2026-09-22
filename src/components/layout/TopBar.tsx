import { useState } from 'react'
import type { Site } from '@/types'
import { SITES } from '@/types'
import type { Page } from '@/store/useStore'
import type { Prefs } from '@/store/persist'
import type { SyncState } from '@/store/sync'
import { ViewMenu } from './ViewMenu'
import { SyncBadge } from './SyncBadge'
import { Button, IconButton, cx } from '@/components/ui/primitives'

const PAGES: { id: Page; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'site', label: 'Whole site' },
  { id: 'staff', label: 'Staff' },
  { id: 'activities', label: 'Activities' },
  { id: 'venues', label: 'Venues' },
]

export function TopBar({
  site, onSite, page, onPage, prefs, onPrefs,
  canUndo, canRedo, onUndo, onRedo,
  onExportCsv, onBackup, onRestore, onImport, onPrint, onStartFresh, onLoadSample,
  sync, onRetrySync,
}: {
  site: Site
  onSite: (site: Site) => void
  page: Page
  onPage: (page: Page) => void
  prefs: Prefs
  onPrefs: (patch: Partial<Prefs>) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExportCsv: () => void
  onBackup: () => void
  onRestore: () => void
  onImport: () => void
  onPrint: () => void
  onStartFresh: () => void
  onLoadSample: () => void
  sync: SyncState
  onRetrySync: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const showsGrid = page === 'plan' || page === 'site'

  return (
    <header className="no-print flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3">
      {/* One shared plan per deployment, so there is no document to name — the
          only thing to choose here is which site you're looking at. */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]"
        >
          W
        </span>
        <div className="relative flex min-w-0 items-center">
          <select
            value={site}
            onChange={(event) => onSite(event.target.value as Site)}
            aria-label="Site"
            className={cx(
              'h-8 min-w-0 appearance-none rounded-md border border-transparent bg-transparent',
              'py-0 pr-6 pl-2 text-[14px] font-semibold text-[var(--ink)]',
              'transition-colors hover:border-[var(--line)] hover:bg-[var(--surface-sunk)]',
              'focus:border-[var(--brand-soft)] focus:outline-none',
            )}
          >
            {SITES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 text-[9px] text-[var(--ink-faint)]"
          >
            &#9662;
          </span>
        </div>
      </div>

      <nav aria-label="Sections" className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-sunk)] p-0.5">
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPage(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={cx(
              'rounded-md px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors',
              page === item.id
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <SyncBadge sync={sync} onRetry={onRetrySync} />

        <div className="flex items-center rounded-md border border-[var(--line)]">
          <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} className="rounded-r-none">
            &#8630;
          </IconButton>
          <span aria-hidden className="h-4 w-px bg-[var(--line)]" />
          <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo} className="rounded-l-none">
            &#8631;
          </IconButton>
        </div>

        {showsGrid && <ViewMenu prefs={prefs} onChange={onPrefs} />}

        <IconButton
          label={prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => onPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
          className="border border-[var(--line)]"
        >
          {prefs.theme === 'dark' ? '☀' : '☽'}
        </IconButton>

        {showsGrid && (
          <Button size="sm" onClick={onPrint}>
            Print / export
          </Button>
        )}

        <div className="relative">
          <Button size="sm" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            Program
            <span aria-hidden className="text-[9px] opacity-60">
              &#9662;
            </span>
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-50 mt-1 w-[280px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
                <MenuItem onClick={() => { setMenuOpen(false); onImport() }}>
                  Import from spreadsheets…
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onExportCsv() }}>
                  Export every session (.csv)
                </MenuItem>
                <div className="my-1 h-px bg-[var(--line)]" />
                <MenuItem onClick={() => { setMenuOpen(false); onBackup() }}>
                  Download a backup of the plan
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onRestore() }}>
                  Restore from a backup…
                </MenuItem>
                <div className="my-1 h-px bg-[var(--line)]" />
                <MenuItem onClick={() => { setMenuOpen(false); onLoadSample() }}>
                  Load the sample week
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onStartFresh() }}>
                  Start fresh…
                </MenuItem>

                {/* The plan is shared now. Saying where it lives is the answer
                    to "will the others see this?", which is the first thing
                    anyone asks of an app like this. */}
                <p className="mt-1 border-t border-[var(--line)] px-3 pt-2 pb-1 text-[11px] leading-snug text-[var(--ink-soft)]">
                  <span className="font-medium text-[var(--ink)]">Saved for everyone.</span> Both
                  sites share one plan, kept in the database behind this site and saved as you
                  type. Open it on any computer and you're looking at the same thing.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-sunk)]"
    >
      {children}
    </button>
  )
}
