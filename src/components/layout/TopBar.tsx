import { useRef, useState } from 'react'
import type { Site } from '@/types'
import { SITES } from '@/types'
import type { Page } from '@/store/useStore'
import type { Prefs } from '@/store/persist'
import { ViewMenu } from './ViewMenu'
import { Button, IconButton, Input, Select, cx } from '@/components/ui/primitives'

const PAGES: { id: Page; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'site', label: 'Whole site' },
  { id: 'staff', label: 'Staff' },
  { id: 'activities', label: 'Activities' },
  { id: 'venues', label: 'Venues' },
]

export function TopBar({
  documentName, onRename, site, onSite, page, onPage, prefs, onPrefs,
  canUndo, canRedo, onUndo, onRedo,
  onExportJson, onExportCsv, onImport, onPrint, onNew, issueCount,
}: {
  documentName: string
  onRename: (name: string) => void
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
  onExportJson: () => void
  onExportCsv: () => void
  onImport: (file: File) => void
  onPrint: () => void
  onNew: () => void
  issueCount: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const showsGrid = page === 'plan' || page === 'site'

  return (
    <header className="no-print flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]"
        >
          W
        </span>
        <div className="flex min-w-0 flex-col">
          <Input
            value={documentName}
            onChange={(event) => onRename(event.target.value)}
            aria-label="Program name"
            className="h-6 w-44 border-transparent bg-transparent px-1 text-[13px] font-semibold hover:border-[var(--line)] focus:border-[var(--brand-soft)]"
          />
          <Select
            value={site}
            onChange={(event) => onSite(event.target.value as Site)}
            aria-label="Site"
            className="h-5 w-44 border-transparent bg-transparent px-1 text-[11px] text-[var(--ink-faint)] hover:border-[var(--line)]"
          >
            {SITES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
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
        {issueCount > 0 && showsGrid && (
          <span
            className="tnum hidden items-center gap-1 rounded-full bg-[var(--danger-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)] lg:inline-flex"
            title={`${issueCount} clash${issueCount === 1 ? '' : 'es'} to resolve`}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            {issueCount}
          </span>
        )}

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
            Print
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
              <div className="absolute right-0 z-50 mt-1 w-[272px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
                <MenuItem onClick={() => { setMenuOpen(false); onNew() }}>New program…</MenuItem>
                <div className="my-1 h-px bg-[var(--line)]" />
                <MenuItem onClick={() => { setMenuOpen(false); onExportJson() }}>
                  Back up to a file (.json)
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); fileRef.current?.click() }}>
                  Restore from a file…
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onExportCsv() }}>
                  Export schedule (.csv)
                </MenuItem>

                {/* There is no server behind this app, so the files are not
                    optional housekeeping — they are the only copy that leaves
                    this browser. Worth saying plainly, right where the
                    question comes up. */}
                <p className="mt-1 border-t border-[var(--line)] px-3 pt-2 pb-1 text-[11px] leading-snug text-[var(--ink-soft)]">
                  <span className="font-medium text-[var(--ink)]">Saved in this browser.</span>{' '}
                  There's no shared database — the program lives in this browser's storage on this
                  computer, and saves as you type. Back up to a file to move it to another machine,
                  send it to someone, or keep a copy safe from cleared site data.
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
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
