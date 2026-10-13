import { useState } from 'react'
import type { Site } from '@/types'
import { SITES } from '@/types'
import type { Page } from '@/store/useStore'
import type { Prefs } from '@/store/persist'
import type { SyncState } from '@/store/sync'
import { ViewMenu } from './ViewMenu'
import { SyncBadge } from './SyncBadge'
import { Button, IconButton, cx } from '@/components/ui/primitives'

/** Where the planning happens, every day. */
const WORK_PAGES: { id: Page; label: string }[] = [
  { id: 'plan', label: 'Plan a school' },
  { id: 'site', label: 'Whole site' },
]

/** The reference lists the planning draws on — visited now and then. */
const REFERENCE_PAGES: { id: Page; label: string }[] = [
  { id: 'activities', label: 'Activities' },
  { id: 'venues', label: 'Venues' },
  { id: 'staff', label: 'Staff' },
]

export function TopBar({
  site, onSite, page, onPage, prefs, onPrefs,
  canUndo, canRedo, onUndo, onRedo,
  onExportCsv, onBackup, onRestore, onImport, onPrint, onStartFresh, onLoadSample,
  onExportWeekExcel, onExportSchoolExcel, schoolName, sync, onRetrySync,
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
  onExportWeekExcel: () => void
  onExportSchoolExcel: () => void
  /** The school currently open, so the menu can name what it will save. */
  schoolName?: string
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

      <nav aria-label="Sections" className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-sunk)] p-0.5">
          {WORK_PAGES.map((item) => (
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
        </div>

        <span aria-hidden className="h-5 w-px bg-[var(--line)]" />

        <div className="flex items-center gap-0.5">
          {REFERENCE_PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPage(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
              className={cx(
                'rounded-md px-2 py-1 text-[12.5px] whitespace-nowrap transition-colors',
                page === item.id
                  ? 'bg-[var(--brand-tint)] font-medium text-[var(--brand)]'
                  : 'text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)] hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
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

        <ViewMenu prefs={prefs} onChange={onPrefs} showsGrid={showsGrid} />

        {showsGrid && (
          <Button size="sm" onClick={onPrint} title="Print or save as PDF (Ctrl+P)">
            Print / PDF
          </Button>
        )}

        <div className="relative">
          <Button size="sm" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            File
            <span aria-hidden className="text-[9px] opacity-60">
              &#9662;
            </span>
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-50 mt-1 w-[300px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
                <MenuHeading>Bring work in</MenuHeading>
                <MenuItem
                  label="Import from spreadsheets…"
                  detail="Old itinerary workbooks, or a zipped week folder."
                  onClick={() => { setMenuOpen(false); onImport() }}
                />

                <MenuHeading>Take a copy out</MenuHeading>
                <MenuItem
                  label="Save this week as a spreadsheet"
                  detail="The holistic sheet as .xlsx, colours and all."
                  onClick={() => { setMenuOpen(false); onExportWeekExcel() }}
                />
                <MenuItem
                  label={
                    schoolName
                      ? `Save ${schoolName} as a spreadsheet`
                      : 'Save the open school as a spreadsheet'
                  }
                  detail="That school's itinerary as .xlsx."
                  onClick={() => { setMenuOpen(false); onExportSchoolExcel() }}
                />
                <MenuItem
                  label="Save every session as a list"
                  detail="One row per session as .csv, for sorting and counting."
                  onClick={() => { setMenuOpen(false); onExportCsv() }}
                />

                <MenuHeading>The whole plan</MenuHeading>
                <MenuItem
                  label="Download a backup"
                  detail="Everything, in one file, in case of a bad day."
                  onClick={() => { setMenuOpen(false); onBackup() }}
                />
                <MenuItem
                  label="Restore from a backup…"
                  detail="Replaces the plan for everyone. Asks first."
                  onClick={() => { setMenuOpen(false); onRestore() }}
                />
                <MenuItem
                  label="Load the sample week"
                  detail="A few overlapping stays, to see how it fits together."
                  onClick={() => { setMenuOpen(false); onLoadSample() }}
                />
                <MenuItem
                  label="Start fresh…"
                  detail="Empties the plan for everyone. Asks first."
                  onClick={() => { setMenuOpen(false); onStartFresh() }}
                />

                {/* The plan is shared. Saying so answers "will the others see
                    this?", the first thing anyone asks of an app like this. */}
                <p className="mt-1 border-t border-[var(--line)] px-3 pt-2 pb-1 text-[11px] leading-snug text-[var(--ink-soft)]">
                  <span className="font-medium text-[var(--ink)]">There’s nothing to save.</span>{' '}
                  Every change is stored as you make it, and everyone sees the same plan.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-[var(--ink-soft)]">
      {children}
    </p>
  )
}

function MenuItem({
  label,
  detail,
  onClick,
}: {
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-sunk)]"
    >
      <span className="block text-[12.5px] font-medium text-[var(--ink)]">{label}</span>
      <span className="block text-[11px] leading-snug text-[var(--ink-faint)]">{detail}</span>
    </button>
  )
}
