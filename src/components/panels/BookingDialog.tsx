import { useMemo, useState } from 'react'
import type { Block, Booking, PackageTier } from '@/types'
import { PACKAGE_LABELS } from '@/types'
import { BUILDINGS } from '@/data/venues'
import { uid } from '@/lib/id'
import { addDays, daysBetween } from '@/lib/time'
import { followBooking } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, IconButton, Input, Select, cx } from '@/components/ui/primitives'

/** Name, student count, remove — shared by the header row and each group row. */
const GROUP_ROW = 'grid grid-cols-[minmax(0,1fr)_76px_28px] items-center gap-1.5'

/**
 * Add a school, or edit one's stay: dates, package, building and groups.
 *
 * Nothing is written until Save, so cancelling an "Add a school" leaves
 * nothing behind. Editing the dates or groups of a school that already has a
 * program says what will happen to its sessions before it happens.
 */
export function BookingDialog({
  booking,
  isNew,
  blocks,
  onSave,
  onDelete,
  onClose,
}: {
  booking: Booking
  /** A draft that doesn't exist in the plan yet. */
  isNew: boolean
  /** This school's sessions, to say what a change of dates or groups does to them. */
  blocks: Block[]
  onSave: (next: Booking) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Booking>(booking)
  const [tried, setTried] = useState(false)

  const buildings = BUILDINGS[draft.site] ?? []
  const name = draft.schoolName.trim()

  function set<K extends keyof Booking>(key: K, value: Booking[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // Moving the arrival keeps the length of the stay, which is what a rebooking
  // almost always means; the departure is still free to change on its own.
  function setArrival(value: string) {
    if (!value) return
    setDraft((current) => {
      const length = daysBetween(current.startDate, current.endDate)
      return { ...current, startDate: value, endDate: addDays(value, Math.max(length, 0)) }
    })
  }

  const impact = useMemo(() => {
    if (isNew) return { moved: 0, removed: 0, shift: 0 }
    const shift = daysBetween(booking.startDate, draft.startDate)
    let removed = 0
    for (const block of blocks) {
      if (!followBooking(block, booking, draft)) removed++
    }
    return { moved: shift === 0 ? 0 : blocks.length - removed, removed, shift }
  }, [isNew, booking, draft, blocks])

  function submit() {
    setTried(true)
    if (!name) return
    onSave({ ...draft, schoolName: name })
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'Add a school' : 'Edit school'}
      width={560}
      onClose={onClose}
      footer={
        <>
          {onDelete && !isNew && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                onDelete()
                onClose()
              }}
            >
              Delete school
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="booking-form">
            {isNew ? 'Add school' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="booking-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field label="School">
          <Input
            value={draft.schoolName}
            onChange={(event) => set('schoolName', event.target.value)}
            placeholder="e.g. Pulteney Grammar School"
            aria-invalid={tried && !name}
            className={cx(tried && !name && 'border-[var(--danger)]')}
          />
          {tried && !name && (
            <span className="mt-1 block text-[11.5px] text-[var(--danger)]">
              Give the school a name — it heads the itinerary.
            </span>
          )}
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
              onChange={(event) => setArrival(event.target.value)}
            />
          </Field>
          <Field label="Departs">
            <Input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(event) => {
                const value = event.target.value
                if (value) set('endDate', value < draft.startDate ? draft.startDate : value)
              }}
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
            <div className={cx(GROUP_ROW, 'text-[10.5px] text-[var(--ink-soft)]')}>
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

        {(impact.moved > 0 || impact.removed > 0) && (
          <div className="space-y-1 rounded-md bg-[var(--warn-tint)] px-3 py-2 text-[12px] leading-snug text-[var(--ink)]">
            {impact.moved > 0 && (
              <p>
                {impact.moved} session{impact.moved === 1 ? '' : 's'} will move{' '}
                {Math.abs(impact.shift)} day{Math.abs(impact.shift) === 1 ? '' : 's'}{' '}
                {impact.shift > 0 ? 'later' : 'earlier'} with the stay.
              </p>
            )}
            {impact.removed > 0 && (
              <p>
                <strong className="font-semibold">
                  {impact.removed} session{impact.removed === 1 ? '' : 's'} will be removed
                </strong>{' '}
                — {impact.removed === 1 ? 'it falls' : 'they fall'} outside the new dates or
                {impact.removed === 1 ? ' was' : ' were'} only on a group you’ve taken out. Undo
                brings {impact.removed === 1 ? 'it' : 'them'} back.
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
