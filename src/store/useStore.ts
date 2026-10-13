import { create } from 'zustand'
import type {
  Activity, Block, Booking, CompetencyLevel, Delivery, Group, Overrides,
  ProgramDocument, Site, StaffMember, Venue,
} from '@/types'
import { DOCUMENT_VERSION, EMPTY_OVERRIDES } from '@/types'
import { competencyKey, overridesOf, resolveActivities, resolveActivityMap } from '@/data/resolve'
import { SEED_ACTIVITIES } from '@/data/activities'
import { SEED_VENUES } from '@/data/venues'
import { SEED_STAFF } from '@/data/staff'
import { createSeedDocument } from '@/data/seed'
import { DAY_TEMPLATES, instantiateTemplate } from '@/data/templates'
import { buildRotation, type RotationSlot } from '@/lib/rotation'
import { colourFromString } from '@/lib/colour'
import { uid } from '@/lib/id'
import { addDays, dateRange, daysBetween } from '@/lib/time'
import type { RemoteState } from '@/lib/api'
import { resetAll } from '@/lib/api'
import {
  loadDocument, loadPrefs, savePrefs, saveDocument, type Prefs,
} from './persist'
import { clearQueue, diffDocuments, documentToOps, enqueue, flushNow, refresh } from './sync'

const HISTORY_LIMIT = 60

/** Edits to the same field closer together than this undo as one. */
const COALESCE_MS = 1500

/** Top-level destinations in the app. */
export type Page = 'plan' | 'site' | 'staff' | 'activities' | 'venues'

/** Pages that show the schedule grid and therefore need the week/day bar. */
export const SCHEDULE_PAGES: Page[] = ['plan', 'site']

export interface Selection {
  blockIds: string[]
}

interface State {
  doc: ProgramDocument
  prefs: Prefs

  /** Undo/redo stacks hold whole documents — they are small enough that
   *  snapshotting is simpler and safer than diffing. */
  past: ProgramDocument[]
  future: ProgramDocument[]

  page: Page
  activeBookingId: string | null
  activeDate: string | null
  selection: Selection
  /** Block ids the grid should flash, e.g. after a rotation is generated. */
  highlightIds: string[]
  search: string
  /**
   * Activities set aside at the top of the palette, ready to drag onto the
   * grid by hand. This is a scratch list for whoever is planning right now —
   * it belongs to this browser, not to the shared plan.
   */
  pickedActivityIds: string[]

  // ── document ──
  setDoc: (doc: ProgramDocument) => void
  /** Replaces the plan with what the database holds. Never sent back up. */
  applyRemote: (remote: RemoteState) => void
  /** Wipes the shared plan — every school, session and catalogue edit. */
  startFresh: () => Promise<void>
  /** Fills an empty database with the sample week. */
  loadSample: () => Promise<void>
  setSite: (site: Site) => void
  undo: () => void
  redo: () => void

  // ── bookings ──
  addBooking: (partial?: Partial<Booking>) => string
  updateBooking: (id: string, patch: Partial<Booking>) => void
  /**
   * Saves the booking dialog. Unlike a plain update, the sessions follow:
   * moving the dates moves them, and anything left outside the new stay or on
   * a group that no longer exists goes with it.
   */
  saveBooking: (id: string, next: Booking) => void
  removeBooking: (id: string) => void
  addGroup: (bookingId: string) => void
  updateGroup: (bookingId: string, groupId: string, patch: Partial<Group>) => void
  removeGroup: (bookingId: string, groupId: string) => void

  // ── blocks ──
  addBlock: (block: Omit<Block, 'id'>) => string
  addBlocks: (blocks: Omit<Block, 'id'>[]) => string[]
  /**
   * `coalesce` names a stream of edits — typing into one field, say — that
   * should come off with a single undo rather than one per keystroke.
   */
  updateBlock: (id: string, patch: Partial<Block>, coalesce?: string) => void
  updateBlocks: (ids: string[], patch: Partial<Block>) => void
  /** A different patch per block, as one undoable step. */
  updateEach: (ids: string[], patch: (block: Block) => Partial<Block> | null) => void
  removeBlocks: (ids: string[]) => void
  duplicateBlocks: (ids: string[]) => void
  moveBlock: (id: string, next: { startMin: number; endMin: number; groupIds?: string[]; date?: string }) => void

  // ── bulk helpers ──
  applyDayTemplate: (templateId: string, bookingId: string, date: string) => void
  generateRotation: (input: {
    bookingId: string
    dates: string[]
    slots: RotationSlot[]
    activityIds: string[]
    groupIds: string[]
    delivery: Delivery
    continueAcrossDays?: boolean
    /** Clear whatever activities are already on those days first. */
    replaceExisting?: boolean
  }) => void
  clearDay: (bookingId: string, date: string) => void
  /** Adds whole stays read out of the old spreadsheets, alongside what's there. */
  importStays: (input: {
    bookings: Booking[]
    blocks: Block[]
    activities: Activity[]
  }) => void

  // ── catalogue editing ──
  saveActivity: (activity: Activity) => void
  /** Creates an activity from just a name, for the box at the top of the palette. */
  addCustomActivity: (name: string) => string | null
  deleteActivity: (id: string) => void
  restoreHiddenActivities: () => void

  saveVenue: (venue: Venue) => void
  deleteVenue: (id: string) => void

  saveStaff: (person: StaffMember) => void
  deleteStaff: (id: string) => void
  setCompetency: (
    staffId: string,
    site: Site,
    activityId: string,
    level: CompetencyLevel | null,
  ) => void
  setCompetencyBulk: (
    edits: { staffId: string; site: Site; activityId: string; level: CompetencyLevel }[],
  ) => void

  // ── ui ──
  setPage: (page: Page) => void
  setActiveBooking: (id: string | null) => void
  setActiveDate: (date: string | null) => void
  select: (blockIds: string[], additive?: boolean) => void
  clearSelection: () => void
  setHighlight: (ids: string[]) => void
  setSearch: (value: string) => void
  setPrefs: (patch: Partial<Prefs>) => void
  pickActivities: (ids: string[]) => void
  unpickActivity: (id: string) => void
  clearPicked: () => void
}

function stamp(doc: ProgramDocument): ProgramDocument {
  return { ...doc, updatedAt: new Date().toISOString() }
}

/**
 * The plan from last time, so the app paints immediately. The database is the
 * record and replaces this the moment it answers; an empty plan is the right
 * starting point for a browser that has never opened the app.
 */
const initialDoc = loadDocument() ?? emptyDocument('woodhouse')
const initialPrefs = loadPrefs()

function emptyDocument(site: Site): ProgramDocument {
  return {
    version: DOCUMENT_VERSION,
    site,
    bookings: [],
    blocks: [],
    customActivities: [],
    customVenues: [],
    customStaff: [],
    overrides: structuredClone(EMPTY_OVERRIDES),
    updatedAt: new Date().toISOString(),
  }
}

export const useStore = create<State>((set, get) => {
  /**
   * Applies a change, pushing the previous document onto the undo stack and
   * sending whatever rows it touched to the database.
   *
   * The diff is what makes row-level saving possible: the store still works in
   * whole documents, but only the bookings and sessions that actually changed
   * go over the wire.
   */
  let lastCoalesce: { key: string; at: number } | null = null

  function commit(mutate: (doc: ProgramDocument) => ProgramDocument, coalesce?: string): void {
    const { doc, past } = get()
    const next = stamp(mutate(doc))
    saveDocument(next)
    enqueue(diffDocuments(doc, next))

    // A run of keystrokes in one field keeps the snapshot from before the
    // first of them, so undo takes the whole word back rather than a letter.
    const now = Date.now()
    const continues =
      coalesce !== undefined &&
      lastCoalesce?.key === coalesce &&
      now - lastCoalesce.at < COALESCE_MS &&
      past.length > 0
    lastCoalesce = coalesce === undefined ? null : { key: coalesce, at: now }

    set({
      doc: next,
      past: continues ? past : [...past, doc].slice(-HISTORY_LIMIT),
      future: [],
    })
  }

  return {
    doc: initialDoc,
    prefs: initialPrefs,
    past: [],
    future: [],

    page: 'plan',
    activeBookingId: initialDoc.bookings[0]?.id ?? null,
    activeDate: initialDoc.bookings[0]?.startDate ?? null,
    selection: { blockIds: [] },
    highlightIds: [],
    search: '',
    pickedActivityIds: [],

    setDoc: (doc) => {
      const previous = get().doc
      saveDocument(doc)
      enqueue(diffDocuments(previous, doc))
      set((s) => ({
        doc,
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: [],
        activeBookingId: doc.bookings[0]?.id ?? null,
        activeDate: doc.bookings[0]?.startDate ?? null,
        selection: { blockIds: [] },
      }))
    },

    /**
     * Takes the database's word for it.
     *
     * The site being viewed and the undo history are this browser's, not the
     * plan's, so they survive. Anything selected that someone else has since
     * deleted is dropped rather than left pointing at nothing.
     */
    applyRemote: (remote) => {
      const current = get().doc
      const doc: ProgramDocument = {
        version: DOCUMENT_VERSION,
        site: current.site,
        bookings: remote.bookings,
        blocks: remote.blocks,
        customActivities: remote.customActivities as ProgramDocument['customActivities'],
        customVenues: remote.customVenues as ProgramDocument['customVenues'],
        customStaff: remote.customStaff as ProgramDocument['customStaff'],
        overrides: remote.overrides ?? structuredClone(EMPTY_OVERRIDES),
        updatedAt: new Date().toISOString(),
      }
      saveDocument(doc)

      const blockIds = new Set(doc.blocks.map((b) => b.id))
      const bookingExists = doc.bookings.some((b) => b.id === get().activeBookingId)

      set((s) => ({
        doc,
        selection: { blockIds: s.selection.blockIds.filter((id) => blockIds.has(id)) },
        activeBookingId: bookingExists
          ? s.activeBookingId
          : (doc.bookings.find((b) => b.site === doc.site)?.id ?? null),
      }))
    },

    startFresh: async () => {
      clearQueue()
      await resetAll()
      const doc = emptyDocument(get().doc.site)
      saveDocument(doc)
      set({
        doc,
        past: [],
        future: [],
        activeBookingId: null,
        activeDate: null,
        selection: { blockIds: [] },
      })
    },

    loadSample: async () => {
      const sample = createSeedDocument()
      // Straight to the database rather than through commit(), so the sample
      // week arrives as one write instead of a hundred.
      enqueue(documentToOps(sample))
      await flushNow()
      await refresh()
      const first = get().doc.bookings[0]
      set({
        past: [],
        future: [],
        activeBookingId: first?.id ?? null,
        activeDate: first?.startDate ?? null,
      })
    },

    setSite: (site) =>
      // Which site you're looking at is a view setting, not part of the plan,
      // so it stays in this browser instead of following everyone else around.
      set((s) => {
        const doc = { ...s.doc, site }
        saveDocument(doc)
        const stillHere = s.doc.bookings.find((b) => b.id === s.activeBookingId)?.site === site
        return {
          doc,
          activeBookingId: stillHere
            ? s.activeBookingId
            : (doc.bookings.find((b) => b.site === site)?.id ?? null),
          selection: { blockIds: [] },
        }
      }),

    undo: () => {
      const { past, doc, future } = get()
      const previous = past[past.length - 1]
      if (!previous) return
      lastCoalesce = null
      saveDocument(previous)
      enqueue(diffDocuments(doc, previous))
      set({
        doc: previous,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, HISTORY_LIMIT),
      })
    },

    redo: () => {
      const { past, doc, future } = get()
      const next = future[0]
      if (!next) return
      lastCoalesce = null
      saveDocument(next)
      enqueue(diffDocuments(doc, next))
      set({
        doc: next,
        past: [...past, doc].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      })
    },

    addBooking: (partial) => {
      const booking = newBookingDraft(get().doc.site, get().activeDate, partial)
      const id = booking.id
      commit((doc) => ({ ...doc, bookings: [...doc.bookings, booking] }))
      set({ activeBookingId: id, activeDate: booking.startDate, page: 'plan' })
      return id
    },

    updateBooking: (id, patch) =>
      commit((doc) => ({
        ...doc,
        bookings: doc.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),

    saveBooking: (id, next) =>
      commit((doc) => {
        const before = doc.bookings.find((b) => b.id === id)
        if (!before) return doc
        return {
          ...doc,
          bookings: doc.bookings.map((b) => (b.id === id ? next : b)),
          blocks: doc.blocks.flatMap((block) => {
            if (block.bookingId !== id) return [block]
            const moved = followBooking(block, before, next)
            return moved ? [moved] : []
          }),
        }
      }),

    removeBooking: (id) => {
      commit((doc) => ({
        ...doc,
        bookings: doc.bookings.filter((b) => b.id !== id),
        blocks: doc.blocks.filter((b) => b.bookingId !== id),
      }))
      if (get().activeBookingId === id) {
        const next = get().doc.bookings[0]
        set({ activeBookingId: next?.id ?? null, activeDate: next?.startDate ?? null })
      }
    },

    addGroup: (bookingId) =>
      commit((doc) => ({
        ...doc,
        bookings: doc.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, groups: [...b.groups, { id: uid('grp'), name: `Group ${b.groups.length + 1}` }] }
            : b,
        ),
      })),

    updateGroup: (bookingId, groupId, patch) =>
      commit((doc) => ({
        ...doc,
        bookings: doc.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, groups: b.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) }
            : b,
        ),
      })),

    removeGroup: (bookingId, groupId) =>
      commit((doc) => ({
        ...doc,
        bookings: doc.bookings.map((b) =>
          b.id === bookingId ? { ...b, groups: b.groups.filter((g) => g.id !== groupId) } : b,
        ),
        // Drop the group from every block, then drop blocks left with no groups.
        blocks: doc.blocks
          .map((block) =>
            block.bookingId === bookingId
              ? { ...block, groupIds: block.groupIds.filter((id) => id !== groupId) }
              : block,
          )
          .filter((block) => block.groupIds.length > 0),
      })),

    addBlock: (block) => {
      const id = uid('blk')
      commit((doc) => ({ ...doc, blocks: [...doc.blocks, { ...block, id }] }))
      return id
    },

    addBlocks: (blocks) => {
      const withIds = blocks.map((block) => ({ ...block, id: uid('blk') }))
      commit((doc) => ({ ...doc, blocks: [...doc.blocks, ...withIds] }))
      return withIds.map((b) => b.id)
    },

    updateBlock: (id, patch, coalesce) =>
      commit(
        (doc) => ({
          ...doc,
          blocks: doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        }),
        coalesce,
      ),

    updateEach: (ids, patch) =>
      commit((doc) => ({
        ...doc,
        blocks: doc.blocks.map((b) => {
          if (!ids.includes(b.id)) return b
          const change = patch(b)
          return change ? { ...b, ...change } : b
        }),
      })),

    updateBlocks: (ids, patch) =>
      commit((doc) => ({
        ...doc,
        blocks: doc.blocks.map((b) => (ids.includes(b.id) ? { ...b, ...patch } : b)),
      })),

    removeBlocks: (ids) => {
      commit((doc) => ({ ...doc, blocks: doc.blocks.filter((b) => !ids.includes(b.id)) }))
      set({ selection: { blockIds: [] } })
    },

    duplicateBlocks: (ids) => {
      const { doc } = get()
      const copies = doc.blocks
        .filter((b) => ids.includes(b.id))
        .map((b) => ({ ...b, id: uid('blk'), startMin: b.startMin, endMin: b.endMin }))
      if (copies.length === 0) return
      commit((d) => ({ ...d, blocks: [...d.blocks, ...copies] }))
      set({ selection: { blockIds: copies.map((c) => c.id) } })
    },

    moveBlock: (id, next) =>
      commit((doc) => ({
        ...doc,
        blocks: doc.blocks.map((b) =>
          b.id === id
            ? {
                ...b,
                startMin: next.startMin,
                endMin: next.endMin,
                groupIds: next.groupIds ?? b.groupIds,
                date: next.date ?? b.date,
              }
            : b,
        ),
      })),

    applyDayTemplate: (templateId, bookingId, date) => {
      const { doc } = get()
      const template = DAY_TEMPLATES.find((t) => t.id === templateId)
      const booking = doc.bookings.find((b) => b.id === bookingId)
      if (!template || !booking) return

      const created = instantiateTemplate(template, booking, date)
      commit((d) => ({
        ...d,
        // Replace any existing meal/logistics scaffolding for that day, but keep
        // the activities the planner has already placed.
        blocks: [
          ...d.blocks.filter(
            (b) => !(b.bookingId === bookingId && b.date === date && b.kind !== 'activity'),
          ),
          ...created,
        ],
      }))
      set({ highlightIds: created.map((b) => b.id) })
    },

    generateRotation: ({
      bookingId, dates, slots, activityIds, groupIds, delivery,
      continueAcrossDays, replaceExisting,
    }) => {
      const { doc } = get()
      const booking = doc.bookings.find((b) => b.id === bookingId)
      if (!booking) return

      const created = buildRotation({
        booking,
        dates,
        slots,
        activityIds,
        groupIds,
        delivery,
        continueAcrossDays,
        activities: allActivitiesMap(doc),
      })
      if (created.length === 0) return

      const targetDays = new Set(dates)
      commit((d) => ({
        ...d,
        blocks: [
          // Meals and logistics stay put — only the activities get replaced.
          ...d.blocks.filter(
            (b) =>
              !replaceExisting ||
              b.bookingId !== bookingId ||
              !targetDays.has(b.date) ||
              b.kind !== 'activity',
          ),
          ...created,
        ],
      }))
      set({ highlightIds: created.map((b) => b.id), selection: { blockIds: [] } })
    },

    clearDay: (bookingId, date) =>
      commit((doc) => ({
        ...doc,
        blocks: doc.blocks.filter((b) => !(b.bookingId === bookingId && b.date === date)),
      })),

    /**
     * Brings in stays read out of the old workbooks.
     *
     * One commit for the lot: a term's import is a few hundred sessions, and
     * sending them as one change keeps it to a single write and a single step
     * on the undo stack — so a migration that went wrong is one Ctrl+Z away.
     */
    importStays: ({ bookings, blocks, activities }) => {
      if (bookings.length === 0) return
      const known = new Set(resolveActivities(get().doc).map((a) => a.id))
      const added = activities.filter((activity) => !known.has(activity.id))

      commit((doc) => ({
        ...doc,
        bookings: [...doc.bookings, ...bookings],
        blocks: [...doc.blocks, ...blocks],
        customActivities: [...doc.customActivities, ...added],
      }))

      const first = bookings[0]
      set({
        activeBookingId: first.id,
        activeDate: first.startDate,
        page: 'plan',
        selection: { blockIds: [] },
      })
    },

    saveActivity: (activity) =>
      commit((doc) => {
        // An activity the user added lives in the document outright; one that
        // came from the seed catalogue is stored as a patch, so a later data
        // refresh still reaches the fields they haven't touched.
        if (isCustom(doc.customActivities, activity.id)) {
          return {
            ...doc,
            customActivities: doc.customActivities.map((a) =>
              a.id === activity.id ? activity : a,
            ),
          }
        }
        if (!SEED_ACTIVITY_IDS.has(activity.id)) {
          return { ...doc, customActivities: [...doc.customActivities, activity] }
        }
        return withOverrides(doc, (o) => ({
          ...o,
          activities: { ...o.activities, [activity.id]: activity },
        }))
      }),

    deleteActivity: (id) =>
      commit((doc) => {
        if (isCustom(doc.customActivities, id)) {
          return { ...doc, customActivities: doc.customActivities.filter((a) => a.id !== id) }
        }
        return withOverrides(doc, (o) => ({
          ...o,
          hiddenActivityIds: [...new Set([...o.hiddenActivityIds, id])],
        }))
      }),

    restoreHiddenActivities: () =>
      commit((doc) => withOverrides(doc, (o) => ({ ...o, hiddenActivityIds: [] }))),

    /**
     * Adds an activity from a name alone.
     *
     * Typing one straight into the palette is the quickest route to something
     * that isn't in the catalogue yet, so it gets sensible defaults and a
     * colour derived from its name. Everything else about it — the colour
     * included — is editable on the Activities page afterwards.
     */
    addCustomActivity: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return null

      const { doc } = get()
      const existing = resolveActivities(doc).find(
        (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (existing) {
        set((s) => ({
          pickedActivityIds: s.pickedActivityIds.includes(existing.id)
            ? s.pickedActivityIds
            : [...s.pickedActivityIds, existing.id],
        }))
        return existing.id
      }

      const activity: Activity = {
        id: uid('act'),
        name: trimmed,
        sites: [doc.site],
        colour: colourFromString(trimmed),
        defaultDurationMin: 90,
        venueIds: [],
        deliveries: ['staff'],
      }
      commit((d) => ({ ...d, customActivities: [...d.customActivities, activity] }))
      set((s) => ({ pickedActivityIds: [...s.pickedActivityIds, activity.id] }))
      return activity.id
    },

    saveVenue: (venue) =>
      commit((doc) => {
        if (isCustom(doc.customVenues, venue.id)) {
          return {
            ...doc,
            customVenues: doc.customVenues.map((v) => (v.id === venue.id ? venue : v)),
          }
        }
        if (!SEED_VENUE_IDS.has(venue.id)) {
          return { ...doc, customVenues: [...doc.customVenues, venue] }
        }
        return withOverrides(doc, (o) => ({ ...o, venues: { ...o.venues, [venue.id]: venue } }))
      }),

    deleteVenue: (id) =>
      commit((doc) => {
        const stripped = {
          ...doc,
          // A venue that's gone can't stay attached to blocks.
          blocks: doc.blocks.map((b) => (b.venueId === id ? { ...b, venueId: undefined } : b)),
        }
        if (isCustom(doc.customVenues, id)) {
          return { ...stripped, customVenues: doc.customVenues.filter((v) => v.id !== id) }
        }
        return withOverrides(stripped, (o) => ({
          ...o,
          hiddenVenueIds: [...new Set([...o.hiddenVenueIds, id])],
        }))
      }),

    saveStaff: (person) =>
      commit((doc) => {
        if (isCustom(doc.customStaff, person.id)) {
          return {
            ...doc,
            customStaff: doc.customStaff.map((p) => (p.id === person.id ? person : p)),
          }
        }
        if (!SEED_STAFF_IDS.has(person.id)) {
          return { ...doc, customStaff: [...doc.customStaff, person] }
        }
        return withOverrides(doc, (o) => ({
          ...o,
          staff: {
            ...o.staff,
            [person.id]: { ...o.staff[person.id], name: person.name, sites: person.sites },
          },
        }))
      }),

    deleteStaff: (id) =>
      commit((doc) => {
        if (isCustom(doc.customStaff, id)) {
          return { ...doc, customStaff: doc.customStaff.filter((p) => p.id !== id) }
        }
        return withOverrides(doc, (o) => ({
          ...o,
          hiddenStaffIds: [...new Set([...o.hiddenStaffIds, id])],
        }))
      }),

    setCompetency: (staffId, site, activityId, level) =>
      commit((doc) =>
        withOverrides(doc, (o) => {
          const key = competencyKey(site, activityId)
          const existing = o.staff[staffId]?.competency ?? {}
          const competency = { ...existing }
          // null clears the edit and falls back to whatever the workbook says.
          if (level === null) delete competency[key]
          else competency[key] = level
          return {
            ...o,
            staff: { ...o.staff, [staffId]: { ...o.staff[staffId], competency } },
          }
        }),
      ),

    setCompetencyBulk: (edits) =>
      commit((doc) =>
        withOverrides(doc, (o) => {
          const staff = { ...o.staff }
          for (const edit of edits) {
            const key = competencyKey(edit.site, edit.activityId)
            staff[edit.staffId] = {
              ...staff[edit.staffId],
              competency: { ...staff[edit.staffId]?.competency, [key]: edit.level },
            }
          }
          return { ...o, staff }
        }),
      ),

    setPage: (page) => {
      if (page !== 'plan') {
        set({ page })
        return
      }
      // Coming back from the whole-site view, the chosen day may be one the
      // selected school isn't on site for. Prefer a school that *is* here that
      // day; otherwise pull the date back into the selected school's stay.
      const { doc, activeBookingId, activeDate } = get()
      const current = doc.bookings.find((b) => b.id === activeBookingId)

      if (!activeDate || (current && activeDate >= current.startDate && activeDate <= current.endDate)) {
        set({ page })
        return
      }

      const onThatDay = doc.bookings.find(
        (b) => b.site === doc.site && activeDate >= b.startDate && activeDate <= b.endDate,
      )
      if (onThatDay) {
        set({ page, activeBookingId: onThatDay.id, selection: { blockIds: [] } })
        return
      }

      set({ page, activeDate: current ? current.startDate : activeDate })
    },
    setActiveBooking: (id) => {
      const booking = get().doc.bookings.find((b) => b.id === id)
      set({
        activeBookingId: id,
        activeDate: booking ? clampDateToBooking(get().activeDate, booking) : null,
        selection: { blockIds: [] },
      })
    },
    setActiveDate: (date) => {
      // On the plan page a day belongs to a school. Asking for a day the open
      // school isn't here for means "show me that day", so open whoever is.
      const { doc, page, activeBookingId } = get()
      const current = doc.bookings.find((b) => b.id === activeBookingId)
      const covers = (b: Booking) => date !== null && date >= b.startDate && date <= b.endDate
      if (page === 'plan' && date && (!current || !covers(current))) {
        const onThatDay = doc.bookings
          .filter((b) => b.site === doc.site && covers(b))
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.schoolName.localeCompare(b.schoolName))[0]
        if (onThatDay) {
          set({ activeDate: date, activeBookingId: onThatDay.id, selection: { blockIds: [] } })
          return
        }
      }
      set({ activeDate: date })
    },

    select: (blockIds, additive) =>
      set((s) => ({
        selection: {
          blockIds: additive
            ? Array.from(new Set([...s.selection.blockIds, ...blockIds]))
            : blockIds,
        },
      })),

    clearSelection: () => set({ selection: { blockIds: [] } }),
    setHighlight: (ids) => set({ highlightIds: ids }),
    setSearch: (value) => set({ search: value }),

    setPrefs: (patch) =>
      set((s) => {
        const prefs = { ...s.prefs, ...patch }
        savePrefs(prefs)
        return { prefs }
      }),

    pickActivities: (ids) =>
      set((s) => ({
        pickedActivityIds: [...new Set([...s.pickedActivityIds, ...ids])],
      })),

    unpickActivity: (id) =>
      set((s) => ({ pickedActivityIds: s.pickedActivityIds.filter((other) => other !== id) })),

    clearPicked: () => set({ pickedActivityIds: [] }),
  }
})

function isCustom<T extends { id: string }>(items: T[] | undefined, id: string): boolean {
  return (items ?? []).some((item) => item.id === id)
}

/** Applies a change to the document's override block, filling in a default. */
function withOverrides(
  doc: ProgramDocument,
  mutate: (overrides: Overrides) => Overrides,
): ProgramDocument {
  return { ...doc, overrides: mutate(overridesOf(doc)) }
}

const SEED_ACTIVITY_IDS = new Set(SEED_ACTIVITIES.map((a) => a.id))
const SEED_VENUE_IDS = new Set(SEED_VENUES.map((v) => v.id))
const SEED_STAFF_IDS = new Set(SEED_STAFF.map((p) => p.id))

/**
 * A fresh booking that hasn't been saved yet — what the "Add a school" dialog
 * edits, so cancelling it leaves nothing behind.
 */
export function newBookingDraft(
  site: Site,
  date: string | null,
  partial?: Partial<Booking>,
): Booking {
  const start = date ?? new Date().toISOString().slice(0, 10)
  return {
    id: uid('bkg'),
    site,
    schoolName: '',
    yearLevel: '',
    packageTier: 'gold',
    building: '',
    startDate: start,
    endDate: addDays(start, 2),
    groups: [
      { id: uid('grp'), name: 'Group 1' },
      { id: uid('grp'), name: 'Group 2' },
    ],
    ...partial,
  }
}

/**
 * Where a session ends up when its booking is edited, or null if it no longer
 * has anywhere to be. Moving the arrival date moves every day with it, so a
 * stay rebooked a week later keeps its program.
 */
export function followBooking(block: Block, before: Booking, after: Booking): Block | null {
  const shift = daysBetween(before.startDate, after.startDate)
  const date = shift === 0 ? block.date : addDays(block.date, shift)
  if (date < after.startDate || date > after.endDate) return null

  const groups = new Set(after.groups.map((g) => g.id))
  const groupIds = block.groupIds.filter((id) => groups.has(id))
  if (groupIds.length === 0) return null

  return { ...block, date, groupIds }
}

function clampDateToBooking(date: string | null, booking: Booking): string {
  const dates = dateRange(booking.startDate, booking.endDate)
  return date && dates.includes(date) ? date : booking.startDate
}

// ─── derived selectors ──────────────────────────────────────────────────────

export function allActivitiesMap(doc: ProgramDocument): Map<string, Activity> {
  return resolveActivityMap(doc)
}

export function activitiesForSite(doc: ProgramDocument, site: Site): Activity[] {
  return resolveActivities(doc).filter((a) => a.sites.includes(site))
}

