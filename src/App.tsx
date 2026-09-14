import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Booking, Issue } from '@/types'
import { SEED_VENUES } from '@/data/venues'
import { SEED_STAFF } from '@/data/staff'
import { ROUTINES } from '@/data/activities'
import { createSeedDocument } from '@/data/seed'
import {
  activitiesForSite, allActivitiesMap, computeIssues, useStore,
} from '@/store/useStore'
import { useDragController } from '@/hooks/useDragController'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { exportCsv, exportJson, importJson } from '@/lib/exportImport'
import { suggestSlots } from '@/lib/rotation'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BookingView } from '@/components/schedule/BookingView'
import { WeekView } from '@/components/week/WeekView'
import { DragGhost } from '@/components/schedule/DragGhost'
import { Inspector } from '@/components/panels/Inspector'
import { RotationDialog } from '@/components/panels/RotationDialog'
import { BookingDialog } from '@/components/panels/BookingDialog'
import { PrintView } from '@/components/print/PrintView'
import { Button, EmptyState } from '@/components/ui/primitives'

export default function App() {
  const doc = useStore((s) => s.doc)
  const prefs = useStore((s) => s.prefs)
  const view = useStore((s) => s.view)
  const activeBookingId = useStore((s) => s.activeBookingId)
  const activeDate = useStore((s) => s.activeDate)
  const selection = useStore((s) => s.selection.blockIds)
  const highlightIds = useStore((s) => s.highlightIds)
  const search = useStore((s) => s.search)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)

  const [rotationOpen, setRotationOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useDragController()
  useKeyboardShortcuts({ onPrint: () => window.print() })

  // Theme is applied to the root element so CSS variables cascade everywhere.
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
  }, [prefs.theme])

  // Highlights are a transient "here's what just happened" cue.
  useEffect(() => {
    if (highlightIds.length === 0) return
    const timer = window.setTimeout(() => useStore.getState().setHighlight([]), 1200)
    return () => window.clearTimeout(timer)
  }, [highlightIds])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activities = useMemo(() => allActivitiesMap(doc), [doc])
  const paletteActivities = useMemo(() => activitiesForSite(doc, doc.site), [doc])
  const issues = useMemo(() => computeIssues(doc), [doc])

  const venueNames = useMemo(
    () => new Map(SEED_VENUES.map((v) => [v.id, v.name])),
    [],
  )
  const staffNames = useMemo(() => new Map(SEED_STAFF.map((s) => [s.id, s.name])), [])
  const venueMap = useMemo(() => new Map(SEED_VENUES.map((v) => [v.id, v])), [])
  const staffMap = useMemo(() => new Map(SEED_STAFF.map((s) => [s.id, s])), [])

  const siteBookings = useMemo(
    () => doc.bookings.filter((b) => b.site === doc.site),
    [doc.bookings, doc.site],
  )

  const booking = useMemo(
    () => doc.bookings.find((b) => b.id === activeBookingId),
    [doc.bookings, activeBookingId],
  )

  const selectedBlocks = useMemo(
    () => doc.blocks.filter((b) => selection.includes(b.id)),
    [doc.blocks, selection],
  )

  const date = activeDate ?? booking?.startDate ?? new Date().toISOString().slice(0, 10)

  const handleSelect = useCallback((blockId: string, additive: boolean) => {
    useStore.getState().select([blockId], additive)
  }, [])

  const handleClearSelection = useCallback(() => {
    useStore.getState().clearSelection()
  }, [])

  const focusIssue = useCallback(
    (issue: Issue) => {
      const store = useStore.getState()
      store.setActiveDate(issue.date)
      if (issue.bookingId) store.setActiveBooking(issue.bookingId)
      else if (issue.blockIds.length > 0) {
        const first = doc.blocks.find((b) => b.id === issue.blockIds[0])
        if (first) store.setActiveBooking(first.bookingId)
      }
      if (issue.blockIds.length > 0) {
        store.select(issue.blockIds)
        store.setHighlight(issue.blockIds)
      }
    },
    [doc.blocks],
  )

  /** Click-to-place from the palette: drops into the first free gap of the day. */
  const quickAdd = useCallback(
    (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => {
      const store = useStore.getState()
      const target = store.doc.bookings.find((b) => b.id === store.activeBookingId)
      if (!target) {
        setToast('Pick a school first.')
        return
      }
      const day = store.activeDate ?? target.startDate
      const existing = store.doc.blocks.filter((b) => b.bookingId === target.id && b.date === day)

      const duration =
        payload.type === 'activity'
          ? (activities.get(payload.id)?.defaultDurationMin ?? 90)
          : (ROUTINES.find((r) => r.id === payload.id)?.durationMin ?? 60)

      const gaps = suggestSlots(
        existing.filter((b) => b.groupIds.includes(target.groups[0]?.id ?? '')),
        { dayStart: prefs.dayStartMin, dayEnd: prefs.dayEndMin, minLength: duration },
      )
      const startMin = gaps[0]?.startMin ?? prefs.dayStartMin

      if (payload.type === 'activity') {
        const activity = activities.get(payload.id)
        if (!activity) return
        const id = store.addBlock({
          bookingId: target.id,
          date: day,
          startMin,
          endMin: startMin + duration,
          groupIds: [target.groups[0].id],
          kind: 'activity',
          activityId: activity.id,
          delivery: activity.deliveries[0] ?? 'staff',
          staffIds: [],
          venueId: activity.venueIds[0],
        })
        store.select([id])
        store.setHighlight([id])
      } else {
        const routine = ROUTINES.find((r) => r.id === payload.id)
        if (!routine) return
        const id = store.addBlock({
          bookingId: target.id,
          date: day,
          startMin,
          endMin: startMin + duration,
          groupIds: routine.wholeSchool ? target.groups.map((g) => g.id) : [target.groups[0].id],
          kind: routine.kind,
          title: routine.title,
          delivery: 'staff',
          staffIds: [],
          colour: routine.colour,
        })
        store.select([id])
        store.setHighlight([id])
      }
    },
    [activities, prefs.dayStartMin, prefs.dayEndMin],
  )

  const handleImport = useCallback(async (file: File) => {
    try {
      const imported = await importJson(file)
      useStore.getState().setDoc(imported)
      setToast(`Opened “${imported.name}”.`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not read that file.')
    }
  }, [])

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden">
      <TopBar
        documentName={doc.name}
        onRename={(name) => useStore.getState().renameDocument(name)}
        site={doc.site}
        onSite={(site) => useStore.getState().setSite(site)}
        view={view}
        onView={(next) => useStore.getState().setView(next)}
        zoom={prefs.zoom}
        onZoom={(zoom) => useStore.getState().setPrefs({ zoom })}
        snapMinutes={prefs.snapMinutes}
        onSnap={(snapMinutes) => useStore.getState().setPrefs({ snapMinutes })}
        theme={prefs.theme}
        onTheme={(theme) => useStore.getState().setPrefs({ theme })}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => useStore.getState().undo()}
        onRedo={() => useStore.getState().redo()}
        onExportJson={() => exportJson(doc)}
        onExportCsv={() => exportCsv(doc, activities, venueMap, staffMap)}
        onImport={handleImport}
        onPrint={() => window.print()}
        onNew={() => {
          if (confirm('Start a new program? The current one stays in your browser until you replace it — export it first if you want a copy.')) {
            useStore.getState().newDocument(doc.site)
          }
        }}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          activities={paletteActivities}
          site={doc.site}
          dark={prefs.theme === 'dark'}
          search={search}
          onSearch={(value) => useStore.getState().setSearch(value)}
          onQuickAdd={quickAdd}
          canAdd={Boolean(booking)}
          bookings={siteBookings}
          activeBookingId={activeBookingId}
          onSelectBooking={(id) => {
            useStore.getState().setActiveBooking(id)
            useStore.getState().setView('booking')
          }}
          onNewBooking={() => {
            const id = useStore.getState().addBooking()
            const created = useStore.getState().doc.bookings.find((b) => b.id === id)
            if (created) setEditingBooking(created)
          }}
          onEditBooking={(id) => {
            const found = doc.bookings.find((b) => b.id === id)
            if (found) setEditingBooking(found)
          }}
          issues={issues}
          onFocusIssue={focusIssue}
        />

        <main className="no-print flex min-w-0 flex-1">
          {view === 'week' ? (
            <WeekView
              bookings={siteBookings}
              date={date}
              blocks={doc.blocks}
              activities={activities}
              venueNames={venueNames}
              staffNames={staffNames}
              issues={issues}
              selection={selection}
              highlightIds={highlightIds}
              dayStartMin={prefs.dayStartMin}
              dayEndMin={prefs.dayEndMin}
              zoom={prefs.zoom}
              dark={prefs.theme === 'dark'}
              showConflicts={prefs.showConflicts}
              onSelect={handleSelect}
              onClearSelection={handleClearSelection}
              onDateChange={(next) => useStore.getState().setActiveDate(next)}
              onOpenBooking={(id) => {
                useStore.getState().setActiveBooking(id)
                useStore.getState().setView('booking')
              }}
              onNewBooking={() => {
                const id = useStore.getState().addBooking({ startDate: date })
                const created = useStore.getState().doc.bookings.find((b) => b.id === id)
                if (created) setEditingBooking(created)
              }}
            />
          ) : booking ? (
            <BookingView
              booking={booking}
              date={date}
              blocks={doc.blocks}
              activities={activities}
              venueNames={venueNames}
              staffNames={staffNames}
              issues={issues}
              selection={selection}
              highlightIds={highlightIds}
              dayStartMin={prefs.dayStartMin}
              dayEndMin={prefs.dayEndMin}
              zoom={prefs.zoom}
              dark={prefs.theme === 'dark'}
              showConflicts={prefs.showConflicts}
              onSelect={handleSelect}
              onClearSelection={handleClearSelection}
              onDateChange={(next) => useStore.getState().setActiveDate(next)}
              onApplyTemplate={(templateId) =>
                useStore.getState().applyDayTemplate(templateId, booking.id, date)
              }
              onOpenRotation={() => setRotationOpen(true)}
              onCopyDay={(from) => useStore.getState().copyDay(booking.id, from, date)}
              onClearDay={() => {
                if (confirm(`Clear everything scheduled for ${booking.schoolName} on this day?`)) {
                  useStore.getState().clearDay(booking.id, date)
                }
              }}
              onEditBooking={() => setEditingBooking(booking)}
              onEmptyDoubleClick={(groupIndex, startMin) => {
                const group = booking.groups[groupIndex]
                if (!group) return
                const id = useStore.getState().addBlock({
                  bookingId: booking.id,
                  date,
                  startMin,
                  endMin: startMin + 90,
                  groupIds: [group.id],
                  kind: 'custom',
                  title: 'New block',
                  delivery: 'staff',
                  staffIds: [],
                })
                useStore.getState().select([id])
              }}
            />
          ) : (
            <EmptyState
              title="No school selected"
              body="Add a school to start building its itinerary, or load the sample week to see how it works."
              action={
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      const id = useStore.getState().addBooking()
                      const created = useStore.getState().doc.bookings.find((b) => b.id === id)
                      if (created) setEditingBooking(created)
                    }}
                  >
                    Add a school
                  </Button>
                  <Button onClick={() => useStore.getState().setDoc(createSeedDocument())}>
                    Load sample week
                  </Button>
                </div>
              }
            />
          )}

          {selectedBlocks.length > 0 && (
            <Inspector
              blocks={selectedBlocks}
              booking={doc.bookings.find((b) => b.id === selectedBlocks[0].bookingId)}
              activities={activities}
              venues={SEED_VENUES}
              site={doc.site}
              issues={issues}
              onClose={handleClearSelection}
            />
          )}
        </main>
      </div>

      <DragGhost dark={prefs.theme === 'dark'} />

      <PrintView
        bookings={view === 'week' ? siteBookings : booking ? [booking] : []}
        blocks={doc.blocks}
        activities={activities}
        programName={doc.name}
      />

      {rotationOpen && booking && (
        <RotationDialog
          booking={booking}
          date={date}
          existingBlocks={doc.blocks.filter((b) => b.bookingId === booking.id && b.date === date)}
          activities={paletteActivities}
          dayStartMin={prefs.dayStartMin}
          dayEndMin={prefs.dayEndMin}
          onGenerate={(input) =>
            useStore.getState().generateRotation({ bookingId: booking.id, date, ...input })
          }
          onClose={() => setRotationOpen(false)}
        />
      )}

      {editingBooking && (
        <BookingDialog
          booking={editingBooking}
          onSave={(patch) => useStore.getState().updateBooking(editingBooking.id, patch)}
          onDelete={() => useStore.getState().removeBooking(editingBooking.id)}
          onClose={() => setEditingBooking(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-[300] -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] shadow-[var(--shadow-lg)]"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
