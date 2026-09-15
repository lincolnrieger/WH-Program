import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Booking, Issue } from '@/types'
import { SITES } from '@/types'
import { ROUTINES } from '@/data/activities'
import { createSeedDocument } from '@/data/seed'
import {
  resolveActivities, resolveActivityMap, resolveStaff, resolveStaffMap, resolveVenueMap,
  resolveVenues,
} from '@/data/resolve'
import { computeIssues, useStore } from '@/store/useStore'
import { useDragController } from '@/hooks/useDragController'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { exportCsv, exportJson, importJson } from '@/lib/exportImport'
import { suggestSlots } from '@/lib/rotation'
import { TopBar } from '@/components/layout/TopBar'
import { WeekBar } from '@/components/layout/WeekBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BookingView } from '@/components/schedule/BookingView'
import { WeekView } from '@/components/week/WeekView'
import { DragGhost } from '@/components/schedule/DragGhost'
import { Inspector } from '@/components/panels/Inspector'
import { RotationDialog } from '@/components/panels/RotationDialog'
import { BookingDialog } from '@/components/panels/BookingDialog'
import { StaffPage } from '@/components/pages/StaffPage'
import { ActivitiesPage } from '@/components/pages/ActivitiesPage'
import { VenuesPage } from '@/components/pages/VenuesPage'
import {
  DEFAULT_PRINT_OPTIONS, PrintView, type PrintOptions,
} from '@/components/print/PrintView'
import { PrintDialog } from '@/components/print/PrintDialog'
import { Button, EmptyState } from '@/components/ui/primitives'

export default function App() {
  const doc = useStore((s) => s.doc)
  const prefs = useStore((s) => s.prefs)
  const page = useStore((s) => s.page)
  const activeBookingId = useStore((s) => s.activeBookingId)
  const activeDate = useStore((s) => s.activeDate)
  const selection = useStore((s) => s.selection.blockIds)
  const highlightIds = useStore((s) => s.highlightIds)
  const search = useStore((s) => s.search)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)

  const [rotationOpen, setRotationOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS)
  const [toast, setToast] = useState<string | null>(null)

  useDragController()
  useKeyboardShortcuts({ onPrint: () => setPrintOpen(true) })

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
  }, [prefs.theme])

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

  // Everything reads the catalogue through the resolver, so records edited on
  // the Activities / Venues / Staff pages behave like the shipped ones.
  const activities = useMemo(() => resolveActivityMap(doc), [doc])
  const activityList = useMemo(() => resolveActivities(doc), [doc])
  const venueList = useMemo(() => resolveVenues(doc), [doc])
  const venueMap = useMemo(() => resolveVenueMap(doc), [doc])
  const staffList = useMemo(() => resolveStaff(doc), [doc])
  const staffMap = useMemo(() => resolveStaffMap(doc), [doc])
  const issues = useMemo(() => computeIssues(doc), [doc])

  const paletteActivities = useMemo(
    () => activityList.filter((a) => a.sites.includes(doc.site)),
    [activityList, doc.site],
  )
  const venueNames = useMemo(
    () => new Map([...venueMap].map(([id, venue]) => [id, venue.name])),
    [venueMap],
  )
  const staffNames = useMemo(
    () => new Map([...staffMap].map(([id, person]) => [id, person.name])),
    [staffMap],
  )

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

  const errorDates = useMemo(() => {
    const set = new Set<string>()
    for (const issue of issues) if (issue.severity === 'error') set.add(issue.date)
    return set
  }, [issues])

  const errorCount = useMemo(
    () => issues.filter((i) => i.severity === 'error').length,
    [issues],
  )

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

  // What the print sheet will contain, given the chosen scope.
  const printBookings = useMemo(() => {
    if (printOptions.scope === 'booking') return booking ? [booking] : []
    if (printOptions.scope === 'site-day') {
      return siteBookings.filter((b) => date >= b.startDate && date <= b.endDate)
    }
    return siteBookings.filter((b) => b.endDate >= date)
  }, [printOptions.scope, booking, siteBookings, date])

  const showsGrid = page === 'plan' || page === 'site'
  const siteName = SITES.find((s) => s.id === doc.site)?.short ?? 'Woodhouse'

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden">
      <TopBar
        documentName={doc.name}
        onRename={(name) => useStore.getState().renameDocument(name)}
        site={doc.site}
        onSite={(site) => useStore.getState().setSite(site)}
        page={page}
        onPage={(next) => useStore.getState().setPage(next)}
        prefs={prefs}
        onPrefs={(patch) => useStore.getState().setPrefs(patch)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => useStore.getState().undo()}
        onRedo={() => useStore.getState().redo()}
        onExportJson={() => exportJson(doc)}
        onExportCsv={() => exportCsv(doc, activities, venueMap, staffMap)}
        onImport={handleImport}
        onPrint={() => setPrintOpen(true)}
        issueCount={errorCount}
        onNew={() => {
          if (
            confirm(
              'Start a new program? The current one stays in your browser until you replace it — export it first if you want a copy.',
            )
          ) {
            useStore.getState().newDocument(doc.site)
          }
        }}
      />

      {showsGrid && (
        <WeekBar
          bookings={siteBookings}
          date={date}
          onDateChange={(next) => useStore.getState().setActiveDate(next)}
          errorDates={errorDates}
        />
      )}

      <div className="flex min-h-0 flex-1">
        {showsGrid && (
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
              useStore.getState().setPage('plan')
            }}
            onNewBooking={() => {
              const id = useStore.getState().addBooking({ startDate: date })
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
        )}

        <main className="no-print flex min-w-0 flex-1">
          {page === 'staff' && (
            <StaffPage site={doc.site} activities={activityList} staff={staffList} />
          )}

          {page === 'activities' && (
            <ActivitiesPage
              site={doc.site}
              activities={activityList}
              venues={venueList}
              dark={prefs.theme === 'dark'}
            />
          )}

          {page === 'venues' && (
            <VenuesPage site={doc.site} venues={venueList} activities={activityList} />
          )}

          {page === 'site' && (
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
              showDetail={prefs.showBlockDetail}
              onSelect={handleSelect}
              onClearSelection={handleClearSelection}
              onOpenBooking={(id) => {
                useStore.getState().setActiveBooking(id)
                useStore.getState().setPage('plan')
              }}
              onNewBooking={() => {
                const id = useStore.getState().addBooking({ startDate: date })
                const created = useStore.getState().doc.bookings.find((b) => b.id === id)
                if (created) setEditingBooking(created)
              }}
            />
          )}

          {page === 'plan' &&
            (booking ? (
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
                showDetail={prefs.showBlockDetail}
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
                        const id = useStore.getState().addBooking({ startDate: date })
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
            ))}

          {showsGrid && selectedBlocks.length > 0 && (
            <Inspector
              blocks={selectedBlocks}
              booking={doc.bookings.find((b) => b.id === selectedBlocks[0].bookingId)}
              activities={activities}
              venues={venueList}
              site={doc.site}
              issues={issues}
              onClose={handleClearSelection}
            />
          )}
        </main>
      </div>

      <DragGhost dark={prefs.theme === 'dark'} />

      <PrintView
        bookings={printBookings}
        blocks={doc.blocks}
        activities={activities}
        venues={venueMap}
        staff={staffMap}
        programName={doc.name}
        options={printOptions}
        siteName={siteName}
        date={date}
      />

      {printOpen && (
        <PrintDialog
          options={printOptions}
          onChange={(patch) => setPrintOptions((current) => ({ ...current, ...patch }))}
          onPrint={() => {
            setPrintOpen(false)
            // Let the dialog unmount before the print sheet is captured.
            window.setTimeout(() => window.print(), 60)
          }}
          onClose={() => setPrintOpen(false)}
          bookingName={booking?.schoolName}
          date={date}
          counts={{
            booking: booking ? 1 : 0,
            siteDay: siteBookings.filter((b) => date >= b.startDate && date <= b.endDate).length,
            siteWeek: siteBookings.filter((b) => b.endDate >= date).length,
          }}
        />
      )}

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
