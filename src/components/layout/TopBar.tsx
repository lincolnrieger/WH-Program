import { useRef, useState } from 'react'
import type { Site } from '@/types'
import { SITES } from '@/types'
import type { ViewMode } from '@/store/useStore'
import { Button, IconButton, Input, Select, cx } from '@/components/ui/primitives'

export function TopBar({
  documentName, onRename, site, onSite, view, onView,
  zoom, onZoom, snapMinutes, onSnap, theme, onTheme,
  canUndo, canRedo, onUndo, onRedo,
  onExportJson, onExportCsv, onImport, onPrint, onNew,
}: {
  documentName: string
  onRename: (name: string) => void
  site: Site
  onSite: (site: Site) => void
  view: ViewMode
  onView: (view: ViewMode) => void
  zoom: number
  onZoom: (zoom: number) => void
  snapMinutes: number
  onSnap: (minutes: number) => void
  theme: 'light' | 'dark'
  onTheme: (theme: 'light' | 'dark') => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onImport: (file: File) => void
  onPrint: () => void
  onNew: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="no-print flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--brand)] text-[13px] text-[var(--brand-ink)]"
        >
          &#9650;
        </span>
        <Input
          value={documentName}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Program name"
          className="h-7 w-40 border-transparent bg-transparent font-semibold hover:border-[var(--line)]"
        />
      </div>

      <Select
        value={site}
        onChange={(event) => onSite(event.target.value as Site)}
        aria-label="Site"
        className="h-7 w-32"
      >
        {SITES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.short}
          </option>
        ))}
      </Select>

      <div className="ml-1 flex rounded-md border border-[var(--line)] p-0.5">
        {(['booking', 'week'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onView(value)}
            className={cx(
              'rounded px-2.5 py-0.5 text-[12px] font-medium transition-colors',
              view === value
                ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
            )}
          >
            {value === 'booking' ? 'School' : 'Whole site'}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          &#8630;
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          &#8631;
        </IconButton>

        <span className="mx-1 h-5 w-px bg-[var(--line)]" />

        <label className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
          Snap
          <Select
            value={snapMinutes}
            onChange={(event) => onSnap(Number(event.target.value))}
            aria-label="Snap increment"
            className="tnum h-7 w-16"
          >
            {[5, 10, 15, 30].map((value) => (
              <option key={value} value={value}>
                {value}m
              </option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
          Zoom
          <input
            type="range"
            min={0.6}
            max={2.4}
            step={0.1}
            value={zoom}
            onChange={(event) => onZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="w-20 accent-[var(--brand)]"
          />
        </label>

        <span className="mx-1 h-5 w-px bg-[var(--line)]" />

        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </IconButton>

        <Button size="sm" onClick={onPrint}>
          Print
        </Button>

        <div className="relative">
          <Button size="sm" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            File &#9662;
          </Button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
                <MenuItem onClick={() => { setMenuOpen(false); onNew() }}>
                  New program…
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); fileRef.current?.click() }}>
                  Open saved file…
                </MenuItem>
                <div className="my-1 h-px bg-[var(--line)]" />
                <MenuItem onClick={() => { setMenuOpen(false); onExportJson() }}>
                  Save to file (.json)
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); onExportCsv() }}>
                  Export schedule (.csv)
                </MenuItem>
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
