import { useState } from 'react'
import type { Booking, PackageTier } from '@/types'
import { PACKAGE_LABELS } from '@/types'
import { BUILDINGS } from '@/data/venues'
import { uid } from '@/lib/id'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, IconButton, Input, Select, cx } from '@/components/ui/primitives'

/** Name, student count, remove — shared by the header row and each group row. */
const GROUP_ROW = 'grid grid-cols-[minmax(0,1fr)_76px_28px] items-center gap-1.5'

/** Create or edit a school's stay: dates, package, building and groups. */
export function BookingDialog({
  booking,
  onSave,
  onDelete,
  onClose,
}: {
  booking: Booking
  onSave: (patch: Partial<Booking>) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Booking>(booking)

  const buildings = BUILDINGS[draft.site] ?? []

  function set<K extends keyof Booking>(key: K, value: Booking[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <Modal
      title={booking.schoolName ? 'Edit booking' : 'New booking'}
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
              Delete booking
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="School">
          <Input
            value={draft.schoolName}
            onChange={(event) => set('schoolName', event.target.value)}
            placeholder="e.g. Pulteney Grammar School"
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Year level">
            <Input
              value={draft.yearLevel}
              onChange={(event) => set('yearLevel', event.target.value)}
              placeholder="Year 5/6"
            />
          </Field>
          <Field label="Students (est.)">
            <Input
              type="number"
              min={0}
              value={draft.studentCount ?? ''}
              onChange={(event) =>
                set('studentCount', event.target.value ? Number(event.target.value) : undefined)
              }
            />
          </Field>
          <Field label="Package">
            <Select
              value={draft.packageTier}
              onChange={(event) => set('packageTier', event.target.value as PackageTier)}
            >
              {(Object.keys(PACKAGE_LABELS) as PackageTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {PACKAGE_LABELS[tier]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Arrives">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(event) => set('startDate', event.target.value)}
            />
          </Field>
          <Field label="Departs">
            <Input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(event) => set('endDate', event.target.value)}
            />
          </Field>
          <Field label="Building">
            <Input
              list="wh-buildings"
              value={draft.building}
              onChange={(event) => set('building', event.target.value)}
              placeholder="Manor"
            />
            <datalist id="wh-buildings">
              {buildings.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Groups" hint="Each group becomes a column on the grid.">
          <div className="space-y-1.5">
            {/* A grid rather than a flex row: two inputs that both want full
                width end up fighting over it, and the name box collapses to a
                square that reads as a stray control. */}
            <div className={cx(GROUP_ROW, 'text-[10.5px] tracking-wide text-[var(--ink-faint)] uppercase')}>
              <span>Name</span>
              <span>Students</span>
              <span />
            </div>
            {draft.groups.map((group, index) => (
              <div key={group.id} className={GROUP_ROW}>
                <Input
                  value={group.name}
                  aria-label={`Group ${index + 1} name`}
                  onChange={(event) =>
                    set(
                      'groups',
                      draft.groups.map((g) =>
                        g.id === group.id ? { ...g, name: event.target.value } : g,
                      ),
                    )
                  }
                />
                <Input
                  className="tnum text-center"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${group.name} size`}
                  placeholder="—"
                  value={group.size ?? ''}
                  onChange={(event) =>
                    set(
                      'groups',
                      draft.groups.map((g) =>
                        g.id === group.id
                          ? { ...g, size: event.target.value ? Number(event.target.value) : undefined }
                          : g,
                      ),
                    )
                  }
                />
                <IconButton
                  label={`Remove ${group.name}`}
                  disabled={draft.groups.length <= 1}
                  onClick={() =>
                    set('groups', draft.groups.filter((g) => g.id !== group.id))
                  }
                >
                  &#10005;
                </IconButton>
              </div>
            ))}
            <Button
              size="sm"
              onClick={() =>
                set('groups', [
                  ...draft.groups,
                  { id: uid('grp'), name: `Group ${draft.groups.length + 1}` },
                ])
              }
            >
              + Add group
            </Button>
          </div>
        </Field>

        <Field label="Notes">
          <Input
            value={draft.notes ?? ''}
            onChange={(event) => set('notes', event.target.value || undefined)}
            placeholder="Dietaries, access needs, organising teacher…"
          />
        </Field>
      </div>
    </Modal>
  )
}
