import { useState } from 'react'
import type { Activity, Delivery, Site, Venue } from '@/types'
import { DELIVERY_LABELS } from '@/types'
import { blockPalette } from '@/lib/colour'
import { Modal } from '@/components/ui/Modal'
import { Button, Chip, Field, Input, Select, cx } from '@/components/ui/primitives'

/**
 * Swatches offered by the colour picker: the fills used by the "Activities
 * Colour Key" sheet, so a new activity can be given one of the colours already
 * in use rather than an approximation of it.
 */
const PRESET_COLOURS = [
  '#ff0000', '#ff3399', '#cc00ff', '#570099', '#9000ff', '#0400ff',
  '#4472c4', '#0099ff', '#66ccff', '#9999ff', '#706dff', '#00b050',
  '#92d050', '#70ad47', '#154d05', '#ffff00', '#ffc000', '#ffd966',
  '#ffe699', '#ed7d31', '#ba5d38', '#9e2d00', '#d1957d', '#f5b68b',
  '#ff99ff', '#ff7a7a', '#a7ffe0', '#00ee99', '#aeaaaa', '#7c7c7c',
]

/** Create or edit an activity: what it's called, its colour, and how long it runs. */
export function ActivityDialog({
  activity,
  venues,
  dark,
  onSave,
  onDelete,
  onClose,
}: {
  activity: Activity
  venues: Venue[]
  dark: boolean
  onSave: (activity: Activity) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Activity>(activity)
  const palette = blockPalette(draft.colour, dark)

  function set<K extends keyof Activity>(key: K, value: Activity[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const siteVenues = venues.filter((v) => draft.sites.some((s) => v.sites.includes(s)))

  return (
    <Modal
      title={activity.name ? 'Edit activity' : 'New activity'}
      width={560}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                onDelete()
                onClose()
              }}
            >
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!draft.name.trim() || draft.sites.length === 0}
            onClick={() => {
              onSave({ ...draft, name: draft.name.trim() })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Live preview of how it will read on the grid. */}
        <div
          className="flex items-center gap-2 overflow-hidden rounded-md border py-2 pr-2 pl-3"
          style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
        >
          <span
            aria-hidden
            className="-ml-3 h-9 w-[3px] shrink-0"
            style={{ background: palette.rail }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold">
              {draft.name || 'Untitled activity'}
            </span>
            <span className="tnum block text-[10.5px]" style={{ color: palette.muted }}>
              {draft.defaultDurationMin} min
            </span>
          </span>
        </div>

        <Field label="Name">
          <Input value={draft.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>

        <Field label="Colour" hint="Used on the grid and as the cell fill on every export.">
          <div className="flex items-start gap-2">
            <input
              type="color"
              value={draft.colour}
              onChange={(e) => set('colour', e.target.value)}
              aria-label="Activity colour"
              className="h-8 w-12 shrink-0 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5"
            />
            <div className="grid flex-1 grid-cols-10 gap-1">
              {PRESET_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  aria-label={`Use ${colour}`}
                  onClick={() => set('colour', colour)}
                  className={cx(
                    'h-4 w-full rounded-sm border border-[var(--line)] transition-transform hover:scale-110',
                    draft.colour.toLowerCase() === colour && 'ring-2 ring-[var(--ink)]',
                  )}
                  style={{ background: colour }}
                />
              ))}
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Runs for (min)">
            <Input
              type="number"
              min={5}
              step={5}
              value={draft.defaultDurationMin}
              onChange={(e) => set('defaultDurationMin', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Venue">
            <Select
              value={draft.venueIds[0] ?? ''}
              onChange={(e) => set('venueIds', e.target.value ? [e.target.value] : [])}
            >
              <option value="">No fixed venue</option>
              {siteVenues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Runs at">
          <div className="flex h-8 items-center gap-3">
            {(['woodhouse', 'roonka'] as Site[]).map((value) => (
              <label key={value} className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={draft.sites.includes(value)}
                  onChange={(e) =>
                    set(
                      'sites',
                      e.target.checked
                        ? [...draft.sites, value]
                        : draft.sites.filter((s) => s !== value),
                    )
                  }
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                {value === 'woodhouse' ? 'Woodhouse' : 'Roonka'}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Offered as" hint="Teacher led prints as “- TL”, self led as “- Self Led”.">
          <div className="flex flex-wrap gap-1">
            {(['staff', 'teacher_led', 'self_led'] as Delivery[]).map((value) => (
              <Chip
                key={value}
                active={draft.deliveries.includes(value)}
                onClick={() =>
                  set(
                    'deliveries',
                    draft.deliveries.includes(value)
                      ? draft.deliveries.filter((d) => d !== value)
                      : [...draft.deliveries, value],
                  )
                }
              >
                {DELIVERY_LABELS[value]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Notes" hint="Shown on the activity in the palette and inspector.">
          <textarea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
            rows={2}
            placeholder="e.g. Better before students do water activities."
            className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-soft)] focus:outline-none"
          />
        </Field>

        <Field
          label="Also called (in the training workbook)"
          hint="Comma separated. Lets staff sign-offs on the Staff page match when the workbook uses different wording."
        >
          <Input
            value={(draft.trainingNames ?? []).join(', ')}
            onChange={(e) =>
              set(
                'trainingNames',
                e.target.value
                  .split(',')
                  .map((part) => part.trim())
                  .filter(Boolean),
              )
            }
            placeholder="e.g. Laser Skirmish LIC, Laser Skirmish 2nd"
          />
        </Field>
      </div>
    </Modal>
  )
}
