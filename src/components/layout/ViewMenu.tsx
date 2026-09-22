import { useEffect, useState } from 'react'
import type { Prefs } from '@/store/persist'
import { formatTimeFull, parseTime } from '@/lib/time'
import { Button, Input, cx } from '@/components/ui/primitives'

/**
 * How the grid is drawn, as a handful of choices rather than a set of dials.
 *
 * The settings underneath are still numbers — zoom, a start and end minute, a
 * snap increment — but nobody plans a camp by deciding they want 140% zoom.
 * They want the day bigger, or they want to stop looking at the evening. So
 * the menu offers those, and keeps the numbers for the one case a preset
 * doesn't cover.
 */

const SIZES: { id: string; label: string; zoom: number }[] = [
  { id: 'compact', label: 'Compact', zoom: 0.8 },
  { id: 'normal', label: 'Normal', zoom: 1.1 },
  { id: 'large', label: 'Large', zoom: 1.5 },
  { id: 'huge', label: 'Huge', zoom: 2.1 },
]

const HOURS: { id: string; label: string; detail: string; start: number; end: number }[] = [
  {
    id: 'activities',
    label: 'Activity hours',
    detail: '8:30am – 5:30pm',
    start: 8 * 60 + 30,
    end: 17 * 60 + 30,
  },
  {
    id: 'camp',
    label: 'Whole camp day',
    detail: '7:00am – 9:30pm',
    start: 7 * 60,
    end: 21 * 60 + 30,
  },
  {
    id: 'everything',
    label: 'Everything',
    detail: '6:00am – 11:00pm',
    start: 6 * 60,
    end: 23 * 60,
  },
]

const SNAP_OPTIONS = [5, 10, 15, 30]

export function ViewMenu({
  prefs,
  onChange,
}: {
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const size = SIZES.reduce((best, option) =>
    Math.abs(option.zoom - prefs.zoom) < Math.abs(best.zoom - prefs.zoom) ? option : best,
  )
  const hours = HOURS.find(
    (option) => option.start === prefs.dayStartMin && option.end === prefs.dayEndMin,
  )
  const showCustom = custom || !hours

  return (
    <div className="relative">
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
            className="absolute right-0 z-50 mt-1.5 w-[290px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]"
          >
            <Group label="Size">
              <Segmented
                options={SIZES.map((option) => ({
                  id: option.id,
                  label: option.label,
                  active: option.id === size.id,
                  onSelect: () => onChange({ zoom: option.zoom }),
                }))}
              />
            </Group>

            <Group label="Hours shown">
              <div className="space-y-1">
                {HOURS.map((option) => (
                  <Choice
                    key={option.id}
                    on={!showCustom && hours?.id === option.id}
                    label={option.label}
                    detail={option.detail}
                    onClick={() => {
                      setCustom(false)
                      onChange({ dayStartMin: option.start, dayEndMin: option.end })
                    }}
                  />
                ))}
                <Choice
                  on={showCustom}
                  label="Custom"
                  detail={`${formatTimeFull(prefs.dayStartMin)} – ${formatTimeFull(prefs.dayEndMin)}`}
                  onClick={() => setCustom(true)}
                />
              </div>

              {showCustom && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <TimeBox
                    label="From"
                    value={prefs.dayStartMin}
                    onCommit={(min) =>
                      onChange({ dayStartMin: Math.min(min, prefs.dayEndMin - 60) })
                    }
                  />
                  <TimeBox
                    label="To"
                    value={prefs.dayEndMin}
                    onCommit={(min) => onChange({ dayEndMin: Math.max(min, prefs.dayStartMin + 60) })}
                  />
                </div>
              )}
            </Group>

            <Group label="Snap dragging to">
              <Segmented
                options={SNAP_OPTIONS.map((value) => ({
                  id: String(value),
                  label: `${value}m`,
                  active: prefs.snapMinutes === value,
                  onSelect: () => onChange({ snapMinutes: value }),
                }))}
              />
              <p className="mt-1 text-[10.5px] text-[var(--ink-faint)]">
                Hold <kbd className="font-sans font-semibold">Alt</kbd> while dragging for
                5-minute steps whatever this says.
              </p>
            </Group>

            <div className="space-y-0.5 border-t border-[var(--line)] pt-2">
              <Toggle
                label="Times on blocks"
                checked={prefs.showBlockTimes}
                onChange={(showBlockTimes) => onChange({ showBlockTimes })}
              />
              <Toggle
                label="Venue on blocks"
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function Segmented({
  options,
}: {
  options: { id: string; label: string; active: boolean; onSelect: () => void }[]
}) {
  return (
    <div className="flex rounded-md border border-[var(--line)] p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={option.onSelect}
          aria-pressed={option.active}
          className={cx(
            'flex-1 rounded px-1.5 py-1 text-[11.5px] font-medium transition-colors',
            option.active
              ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
              : 'text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Choice({
  on,
  label,
  detail,
  onClick,
}: {
  on: boolean
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'flex w-full items-baseline gap-2 rounded-md border px-2 py-1 text-left transition-colors',
        on
          ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
          : 'border-transparent hover:bg-[var(--surface-sunk)]',
      )}
    >
      <span className="text-[12px] font-medium text-[var(--ink)]">{label}</span>
      <span className="tnum ml-auto text-[10.5px] text-[var(--ink-faint)]">{detail}</span>
    </button>
  )
}

function TimeBox({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (min: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="flex flex-1 items-center gap-1.5">
      <span className="text-[10.5px] text-[var(--ink-faint)]">{label}</span>
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
    </label>
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
