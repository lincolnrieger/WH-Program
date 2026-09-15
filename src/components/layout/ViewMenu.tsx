import { useEffect, useRef, useState } from 'react'
import type { Prefs } from '@/store/persist'
import { formatTimeFull, parseTime } from '@/lib/time'
import { Button, IconButton, Input, cx } from '@/components/ui/primitives'

const SNAP_OPTIONS = [5, 10, 15, 30]
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2.4
const ZOOM_STEP = 0.1

/**
 * Grid display settings, gathered into one popover.
 *
 * These used to sit inline in the toolbar as a tiny select and an unlabelled
 * slider, which was both cramped and hard to read at a glance.
 */
export function ViewMenu({
  prefs,
  onChange,
}: {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const zoomPercent = Math.round(prefs.zoom * 100)

  function nudgeZoom(delta: number) {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((prefs.zoom + delta).toFixed(2))))
    onChange({ zoom: next })
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        View
        <span aria-hidden className="text-[9px] opacity-60">
          &#9662;
        </span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="View settings"
            className="absolute right-0 z-50 mt-1.5 w-[272px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]"
          >
            <Row label="Snap to">
              <div className="flex rounded-md border border-[var(--line)] p-0.5">
                {SNAP_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange({ snapMinutes: value })}
                    className={cx(
                      'tnum flex-1 rounded px-1.5 py-1 text-[11.5px] font-medium transition-colors',
                      prefs.snapMinutes === value
                        ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                        : 'text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
                    )}
                  >
                    {value}m
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10.5px] text-[var(--ink-faint)]">
                Hold <kbd className="font-sans font-semibold">Alt</kbd> while dragging for 5-minute
                steps.
              </p>
            </Row>

            <Row label="Zoom">
              <div className="flex items-center gap-1.5">
                <IconButton
                  label="Zoom out"
                  onClick={() => nudgeZoom(-ZOOM_STEP)}
                  disabled={prefs.zoom <= ZOOM_MIN}
                  className="border border-[var(--line)]"
                >
                  &#8722;
                </IconButton>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={ZOOM_STEP}
                  value={prefs.zoom}
                  onChange={(event) => onChange({ zoom: Number(event.target.value) })}
                  aria-label="Zoom level"
                  className="min-w-0 flex-1 accent-[var(--brand)]"
                />
                <IconButton
                  label="Zoom in"
                  onClick={() => nudgeZoom(ZOOM_STEP)}
                  disabled={prefs.zoom >= ZOOM_MAX}
                  className="border border-[var(--line)]"
                >
                  +
                </IconButton>
                <span className="tnum w-10 shrink-0 text-right text-[11.5px] text-[var(--ink-soft)]">
                  {zoomPercent}%
                </span>
              </div>
            </Row>

            <Row label="Day starts / ends">
              <div className="flex items-center gap-1.5">
                <TimeBox
                  value={prefs.dayStartMin}
                  onCommit={(min) => onChange({ dayStartMin: Math.min(min, prefs.dayEndMin - 60) })}
                />
                <span className="text-[var(--ink-faint)]">–</span>
                <TimeBox
                  value={prefs.dayEndMin}
                  onCommit={(min) => onChange({ dayEndMin: Math.max(min, prefs.dayStartMin + 60) })}
                />
              </div>
            </Row>

            <div className="mt-1 space-y-1 border-t border-[var(--line)] pt-2">
              <Toggle
                label="Highlight clashes"
                checked={prefs.showConflicts}
                onChange={(showConflicts) => onChange({ showConflicts })}
              />
              <Toggle
                label="Show venue and staff on blocks"
                checked={prefs.showBlockDetail}
                onChange={(showBlockDetail) => onChange({ showBlockDetail })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function TimeBox({ value, onCommit }: { value: number; onCommit: (min: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      className="tnum h-7 text-center"
      value={draft ?? formatTimeFull(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        setDraft(null)
        const parsed = parseTime(event.target.value)
        if (parsed !== null) onCommit(parsed)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(null)
      }}
    />
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px] text-[var(--ink)] hover:bg-[var(--surface-sunk)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--brand)]"
      />
      {label}
    </label>
  )
}
