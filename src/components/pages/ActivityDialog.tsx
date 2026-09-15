import { useState } from 'react'
import type { Activity, ActivityCategory, Delivery, Site, Venue } from '@/types'
import { CATEGORY_LABELS, DELIVERY_LABELS } from '@/types'
import { blockPalette } from '@/lib/colour'
import { Modal } from '@/components/ui/Modal'
import { Button, Chip, Field, Input, Select, cx } from '@/components/ui/primitives'

/** Swatches offered by the colour picker — the hues already in use on site. */
const PRESET_COLOURS = [
  '#e8412c', '#ff3399', '#cc00ff', '#7030a0', '#4472c4', '#0099ff',
  '#66ccff', '#00a05a', '#4caf3f', '#92d050', '#ffc000', '#ed7d31',
  '#ba5d38', '#9e2d00', '#154d05', '#aeaaaa',
]

/**
 * Create or edit an activity, including everything the scheduling checks rely
 * on: how long it runs, what it needs, and what it must not run alongside.
 */
export function ActivityDialog({
  activity,
  allActivities,
  venues,
  dark,
  onSave,
  onDelete,
  onClose,
}: {
  activity: Activity
  allActivities: Activity[]
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
      width={620}
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
              {draft.minStaff > 0 ? ` · ${draft.minStaff} staff` : ''}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Colour">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={draft.colour}
                onChange={(e) => set('colour', e.target.value)}
                aria-label="Activity colour"
                className="h-8 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5"
              />
              <div className="grid grid-cols-8 gap-0.5">
                {PRESET_COLOURS.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={`Use ${colour}`}
                    onClick={() => set('colour', colour)}
                    className={cx(
                      'h-3.5 w-3.5 rounded-sm transition-transform hover:scale-125',
                      draft.colour.toLowerCase() === colour && 'ring-2 ring-[var(--ink)]',
                    )}
                    style={{ background: colour }}
                  />
                ))}
              </div>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <Select
              value={draft.category}
              onChange={(e) => set('category', e.target.value as ActivityCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Runs for (min)">
            <Input
              type="number"
              min={5}
              step={5}
              value={draft.defaultDurationMin}
              onChange={(e) => set('defaultDurationMin', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Set-up (min)">
            <Input
              type="number"
              min={0}
              step={5}
              value={draft.setupMin}
              onChange={(e) => set('setupMin', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Pack-down (min)">
            <Input
              type="number"
              min={0}
              step={5}
              value={draft.packdownMin}
              onChange={(e) => set('packdownMin', Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Staff needed">
            <Input
              type="number"
              min={0}
              value={draft.minStaff}
              onChange={(e) => set('minStaff', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Max students" hint="Leave blank for no cap.">
            <Input
              type="number"
              min={0}
              value={draft.capacity ?? ''}
              onChange={(e) =>
                set('capacity', e.target.value ? Number(e.target.value) : undefined)
              }
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

        <Field label="Offered as">
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

        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--line)] px-2.5 py-2">
          <input
            type="checkbox"
            checked={draft.exclusive ?? false}
            onChange={(e) => set('exclusive', e.target.checked || undefined)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--brand)]"
          />
          <span>
            <span className="block text-[12.5px] font-medium text-[var(--ink)]">
              Only one group at a time
            </span>
            <span className="block text-[11px] text-[var(--ink-soft)]">
              For a single set of equipment — flags a clash if two schools book it at once.
            </span>
          </span>
        </label>

        <Field
          label="Must not run at the same time as"
          hint="Only needs setting on one side of a pair."
        >
          <div className="max-h-36 overflow-y-auto rounded-md border border-[var(--line)] p-1">
            <div className="flex flex-wrap gap-1">
              {allActivities
                .filter((a) => a.id !== draft.id)
                .map((other) => (
                  <Chip
                    key={other.id}
                    colour={other.colour}
                    active={draft.conflictsWith.includes(other.id)}
                    onClick={() =>
                      set(
                        'conflictsWith',
                        draft.conflictsWith.includes(other.id)
                          ? draft.conflictsWith.filter((id) => id !== other.id)
                          : [...draft.conflictsWith, other.id],
                      )
                    }
                  >
                    {other.name}
                  </Chip>
                ))}
            </div>
          </div>
        </Field>

        <Field label="Scheduling notes" hint="Shown on the activity in the palette and inspector.">
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
          hint="Comma separated. Lets staff sign-offs match when the workbook uses different wording."
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
