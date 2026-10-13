import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Block, Booking } from '@/types'
import { SITES } from '@/types'
import { ROUTINES } from '@/data/activities'
import {
  resolveActivities, resolveActivityMap, resolveStaff, resolveVenueMap, resolveVenues,
} from '@/data/resolve'
import { newBookingDraft, useStore } from '@/store/useStore'
import { DAY_TEMPLATES } from '@/data/templates'
import { flushNow, refresh, startSync, subscribeToSync, syncState, type SyncState } from '@/store/sync'
import { useDragController } from '@/hooks/useDragController'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { exportBackup, pickBackupFile, readBackup } from '@/lib/backup'
import { exportBookingWorkbook, exportHolisticWorkbook } from '@/lib/excelExport'
import { exportCsv } from '@/lib/exportImport'
import { suggestSlots } from '@/lib/rotation'
import { addDays, formatTimeFull, startOfWeek, weekdayShort } from '@/lib/time'
import { TopBar } from '@/components/layout/TopBar'
import { WeekBar } from '@/components/layout/WeekBar'
import { SyncNotice } from '@/components/layout/SyncNotice'
import { Sidebar } from '@/components/layout/Sidebar'
import { SchoolBar } from '@/components/layout/SchoolBar'
import { BookingView } from '@/components/schedule/BookingView'
import { WeekView } from '@/components/week/WeekView'
import { DragGhost } from '@/components/schedule/DragGhost'
import { Inspector } from '@/components/panels/Inspector'
import { RotationDialog } from '@/components/panels/RotationDialog'
import { BookingDialog } from '@/components/panels/BookingDialog'
import { ImportDialog } from '@/components/panels/ImportDialog'
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
  const pickedActivityIds = useStore((s) => s.pickedActivityIds)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)

  const [rotationOpen, setRotationOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<{ booking: Booking; isNew: boolean } | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS)
  const [toast, setToastState] = useState<{ message: string; undo: boolean; key: number } | null>(null)
  const [sync, setSync] = useState<SyncState>(() => syncState())

  /**
   * Says what just happened. Anything that removed or replaced work offers an
   * Undo right there, which is kinder than an "are you sure?" up front and
   * means the common case costs one click instead of two.
   */
  const setToast = useCallback((message: string, undo = false) => {
    setToastState({ message, undo, key: Date.now() })
  }, [])

  const removeBlocks = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      useStore.getState().removeBlocks(ids)
      setToast(ids.length === 1 ? 'Session deleted.' : `${ids.length} sessions deleted.`, true)
    },
    [setToast],
  )

  useDragController()
  useKeyboardShortcuts({ onPrint: () => setPrintOpen(true), onDelete: removeBlocks })

  // Read the shared plan, then keep watching for anyone else's changes.
  useEffect(() => subscribeToSync(setSync), [])

  useEffect(() => {
    void startSync({
      onRemoteState: (remote) => useStore.getState().applyRemote(remote),
      // A browser that used the app before it had a database still has that
      // plan. If the database is empty, it is the plan — send it up rather
      // than letting the upgrade quietly lose a term's work.
      localFallback: () => useStore.getState().doc,
    })
  }, [])

  // Closing the tab mid-edit shouldn't cost the last half-second of typing.
  useEffect(() => {
    const send = () => void flushNow()
    window.addEventListener('pagehide', send)
    return () => window.removeEventListener('pagehide', send)
  }, [])

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
    const timer = window.setTimeout(() => setToastState(null), toast.undo ? 7000 : 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Everything reads the catalogue through the resolver, so records edited on
  // the Activities / Venues / Staff pages behave like the shipped ones.
  const activities = useMemo(() => resolveActivityMap(doc), [doc])
  const activityList = useMemo(() => resolveActivities(doc), [doc])
  const venueList = useMemo(() => resolveVenues(doc), [doc])
  const venueMap = useMemo(() => resolveVenueMap(doc), [doc])
  const staffList = useMemo(() => resolveStaff(doc), [doc])

  const paletteActivities = useMemo(
    () => activityList.filter((a) => a.sites.includes(doc.site)),
    [activityList, doc.site],
  )
  const pickedActivities = useMemo(
    () =>
      pickedActivityIds
        .map((id) => activities.get(id))
        .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity)),
    [pickedActivityIds, activities],
  )
  const venueNames = useMemo(
    () => new Map([...venueMap].map(([id, venue]) => [id, venue.name])),
    [venueMap],
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

  const handleSelect = useCallback((blockId: string, additive: boolean) => {
    useStore.getState().select([blockId], additive)
  }, [])

  const handleClearSelection = useCallback(() => {
    useStore.getState().clearSelection()
  }, [])

  /**
   * Click-to-place from the palette: the earliest free gap on the open day,
   * looking across every group rather than only the first, so clicking
   * through a list of activities spreads them over the groups.
   */
  const quickAdd = useCallback(
    (payload: { type: 'activity'; id: string } | { type: 'routine'; id: string }) => {
      const store = useStore.getState()
      const target = store.doc.bookings.find((b) => b.id === store.activeBookingId)
      if (!target || target.groups.length === 0) {
        setToast('Open a school first.')
        return
      }
      const day = store.activeDate ?? target.startDate
      if (day < target.startDate || day > target.endDate) {
        setToast(`${target.schoolName} isn’t on site that day.`)
        return
      }
      const existing = store.doc.blocks.filter((b) => b.bookingId === target.id && b.date === day)

      const activity = payload.type === 'activity' ? activities.get(payload.id) : undefined
      const routine = payload.type === 'routine' ? ROUTINES.find((r) => r.id === payload.id) : undefined
      if (!activity && !routine) return

      const duration = activity?.defaultDurationMin ?? routine?.durationMin ?? 60
      const hours = { dayStart: prefs.dayStartMin, dayEnd: prefs.dayEndMin }

      // A whole-school routine needs the time free for everyone at once.
      const candidates = routine?.wholeSchool
        ? [{ groupIds: target.groups.map((g) => g.id), blocks: existing }]
        : target.groups.map((group) => ({
            groupIds: [group.id],
            blocks: existing.filter((b) => b.groupIds.includes(group.id)),
          }))

      let best: { groupIds: string[]; startMin: number } | null = null
      for (const candidate of candidates) {
        const startMin = firstFreeStart(candidate.blocks, duration, hours)
        if (startMin !== null && (best === null || startMin < best.startMin)) {
          best = { groupIds: candidate.groupIds, startMin }
        }
      }
      if (!best) {
        setToast('No free time left on this day — drag it where you want it instead.')
        return
      }

      const base = {
        bookingId: target.id,
        date: day,
        startMin: best.startMin,
        endMin: best.startMin + duration,
        groupIds: best.groupIds,
      }
      const id = activity
        ? store.addBlock({
            ...base,
            kind: 'activity',
            activityId: activity.id,
            delivery: activity.deliveries[0] ?? 'staff',
            venueId: activity.venueIds[0],
          })
        : store.addBlock({
            ...base,
            kind: routine!.kind,
            title: routine!.title,
            delivery: routine!.delivery ?? 'staff',
            colour: routine!.colour,
          })
      store.select([id])
      store.setHighlight([id])

      const who =
        best.groupIds.length === target.groups.length && target.groups.length > 1
          ? 'the whole school'
          : (target.groups.find((g) => g.id === best.groupIds[0])?.name ?? 'the group')
      const name = activity?.name ?? routine!.title.split('\n')[0]
      setToast(`${name} added for ${who} at ${formatTimeFull(best.startMin)}.`, true)
    },
    [activities, prefs.dayStartMin, prefs.dayEndMin, setToast],
  )

  const addCustomActivity = useCallback(
    (name: string) => {
      const id = useStore.getState().addCustomActivity(name)
      setToast(
        id
          ? `“${name.trim()}” is ready at the top of the list — drag it onto the grid.`
          : 'Give the activity a name first.',
      )
    },
    [setToast],
  )

  const openNewSchool = useCallback(
    (startDate: string) => {
      setEditingBooking({ booking: newBookingDraft(doc.site, startDate), isNew: true })
    },
    [doc.site],
  )

  const deleteSchool = useCallback(
    (target: Booking) => {
      const sessions = doc.blocks.filter((b) => b.bookingId === target.id).length
      useStore.getState().removeBooking(target.id)
      setToast(
        `${target.schoolName || 'School'} deleted${sessions ? `, with its ${sessions} session${sessions === 1 ? '' : 's'}` : ''}.`,
        true,
      )
    },
    [doc.blocks, setToast],
  )

  const loadSample = useCallback(async () => {
    if (
      doc.bookings.length > 0 &&
      !confirm(
        'Add the sample week to the shared plan? It sits alongside whatever is already there, and you can delete the sample schools afterwards.',
      )
    ) {
      return
    }
    try {
      await useStore.getState().loadSample()
      setToast('Sample week added.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not add the sample week.')
    }
  }, [doc.bookings.length, setToast])

  const startFresh = useCallback(async () => {
    if (
      !confirm(
        'Delete the whole plan — every school, session and catalogue edit — for everyone? This cannot be undone.',
      )
    ) {
      return
    }
    try {
      await useStore.getState().startFresh()
      setToast('Plan cleared.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not clear the plan.')
    }
  }, [setToast])

  const restoreBackup = useCallback(async () => {
    const file = await pickBackupFile()
    if (!file) return
    try {
      const restored = await readBackup(file)
      if (
        !confirm(
          `Replace the whole plan with this backup — ${restored.bookings.length} school(s) and ` +
            `${restored.blocks.length} session(s) — for everyone? This cannot be undone.`,
        )
      ) {
        return
      }
      useStore.getState().setDoc({ ...restored, site: doc.site })
      setToast('Backup restored.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not read that backup.')
    }
  }, [doc.site, setToast])

  // What the print sheet will contain, given the chosen scope. The two site
  // scopes hand over every booking and let the sheet decide — it already knows
  // which week it is drawing.
  const printBookings = useMemo(() => {
    if (printOptions.scope === 'booking' || printOptions.scope === 'booking-day') {
      return booking ? [booking] : []
    }
    if (printOptions.scope === 'site-day') {
      return siteBookings.filter((b) => date >= b.startDate && date <= b.endDate)
    }
    return siteBookings
  }, [printOptions.scope, booking, siteBookings, date])

  const excelInput = useMemo(
    () => ({ blocks: doc.blocks, activities, activityList, site: doc.site }),
    [doc.blocks, activities, activityList, doc.site],
  )

  const exportWeekExcel = useCallback(() => {
    exportHolisticWorkbook({ ...excelInput, bookings: siteBookings, date })
    setToast('Week saved as a spreadsheet.')
  }, [excelInput, siteBookings, date, setToast])

  const exportSchoolExcel = useCallback(() => {
    if (!booking) {
      setToast('Pick a school first.')
      return
    }
    exportBookingWorkbook({ ...excelInput, bookings: [booking] })
    setToast(`${booking.schoolName} saved as a spreadsheet.`)
  }, [excelInput, booking, setToast])

  const weekBounds = useMemo(() => {
    const start = startOfWeek(date)
    return { start, end: addDays(start, 6) }
  }, [date])

  const showsGrid = page === 'plan' || page === 'site'
  const siteName = SITES.find((s) => s.id === doc.site)?.short ?? 'Woodhouse'

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden">
      <TopBar
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
        onExportCsv={() => exportCsv(doc, activities, venueMap)}
        onBackup={() => exportBackup(doc)}
        onRestore={() => void restoreBackup()}
        onExportWeekExcel={exportWeekExcel}
        onExportSchoolExcel={exportSchoolExcel}
        schoolName={booking?.schoolName}
        onImport={() => setImportOpen(true)}
        onPrint={() => setPrintOpen(true)}
        sync={sync}
        onRetrySync={() => void refresh()}
        onLoadSample={() => void loadSample()}
        onStartFresh={() => void startFresh()}
      />

      <SyncNotice sync={sync} onRetry={() => void refresh()} />

      {showsGrid && (
        <WeekBar
          bookings={siteBookings}
          date={date}
          stay={page === 'plan' ? booking : undefined}
          onDateChange={(next) => useStore.getState().setActiveDate(next)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        {showsGrid && (
          <Sidebar
            activities={paletteActivities}
            picked={pickedActivities}
            site={doc.site}
            dark={prefs.theme === 'dark'}
            search={search}
            onSearch={(value) => useStore.getState().setSearch(value)}
            onQuickAdd={quickAdd}
            canAdd={Boolean(booking) || page === 'site'}
            onAddCustom={addCustomActivity}
            onUnpick={(id) => useStore.getState().unpickActivity(id)}
            onClearPicked={() => useStore.getState().clearPicked()}
          />
        )}

        <main className="no-print flex min-w-0 flex-1 flex-col">
          {page === 'plan' && (
            <SchoolBar
              bookings={siteBookings}
              date={date}
              activeBookingId={booking ? booking.id : null}
              onOpen={(id) => useStore.getState().setActiveBooking(id)}
              onAdd={() => openNewSchool(date)}
            />
          )}

          <div className="flex min-h-0 flex-1">
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
                selection={selection}
                highlightIds={highlightIds}
                dayStartMin={prefs.dayStartMin}
                dayEndMin={prefs.dayEndMin}
                zoom={prefs.zoom}
                dark={prefs.theme === 'dark'}
                showDetail={prefs.showBlockDetail}
                showTimes={prefs.showBlockTimes}
                onSelect={handleSelect}
                onClearSelection={handleClearSelection}
                onOpenBooking={(id) => {
                  useStore.getState().setActiveBooking(id)
                  useStore.getState().setPage('plan')
                }}
                onNewBooking={() => openNewSchool(date)}
                onDateChange={(next) => useStore.getState().setActiveDate(next)}
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
                  selection={selection}
                  highlightIds={highlightIds}
                  dayStartMin={prefs.dayStartMin}
                  dayEndMin={prefs.dayEndMin}
                  zoom={prefs.zoom}
                  dark={prefs.theme === 'dark'}
                  showDetail={prefs.showBlockDetail}
                  showTimes={prefs.showBlockTimes}
                  mode={prefs.planMode}
                  onMode={(planMode) => useStore.getState().setPrefs({ planMode })}
                  onSelect={handleSelect}
                  onClearSelection={handleClearSelection}
                  onDateChange={(next) => useStore.getState().setActiveDate(next)}
                  onApplyTemplate={(templateId) => {
                    useStore.getState().applyDayTemplate(templateId, booking.id, date)
                    const name = DAY_TEMPLATES.find((t) => t.id === templateId)?.name ?? 'Template'
                    setToast(`${name} laid out on ${weekdayShort(date)} ${Number(date.slice(8))}.`, true)
                  }}
                  onOpenRotation={() => setRotationOpen(true)}
                  onClearDay={() => {
                    useStore.getState().clearDay(booking.id, date)
                    setToast(`${weekdayShort(date)} ${Number(date.slice(8))} cleared.`, true)
                  }}
                  onEditBooking={() => setEditingBooking({ booking, isNew: false })}
                  onDeleteBooking={() => deleteSchool(booking)}
                  onExportSpreadsheet={exportSchoolExcel}
                  onAddSchool={openNewSchool}
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
                    })
                    useStore.getState().select([id])
                  }}
                />
              ) : (
                <EmptyState
                  title={
                    sync.status === 'loading'
                      ? 'Loading the plan…'
                      : siteBookings.length === 0
                        ? `No schools at ${siteName} yet`
                        : 'Pick a school to plan'
                  }
                  body={
                    sync.status === 'loading'
                      ? 'Reading the shared plan from the database.'
                      : siteBookings.length === 0
                        ? 'Add a school to start building its itinerary, or load the sample week to see how it all works.'
                        : 'Choose one of this week’s schools above, find one in another week, or add a new one.'
                  }
                  action={
                    sync.status === 'loading' ? undefined : (
                      <div className="flex gap-2">
                        <Button variant="primary" onClick={() => openNewSchool(date)}>
                          Add a school
                        </Button>
                        {siteBookings.length === 0 && (
                          <Button onClick={() => void loadSample()}>Load the sample week</Button>
                        )}
                      </div>
                    )
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
                onClose={handleClearSelection}
                onRemove={removeBlocks}
              />
            )}
          </div>
        </main>
      </div>

      <DragGhost dark={prefs.theme === 'dark'} />

      <PrintView
        bookings={printBookings}
        blocks={doc.blocks}
        activities={activities}
        programName={siteName}
        options={printOptions}
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
            siteWeek: siteBookings.filter(
              (b) => b.startDate <= weekBounds.end && b.endDate >= weekBounds.start,
            ).length,
          }}
        />
      )}

      {rotationOpen && booking && (
        <RotationDialog
          booking={booking}
          date={date >= booking.startDate && date <= booking.endDate ? date : booking.startDate}
          blocks={doc.blocks.filter((b) => b.bookingId === booking.id)}
          activities={paletteActivities}
          dayStartMin={prefs.dayStartMin}
          dayEndMin={prefs.dayEndMin}
          onGenerate={(input) => {
            useStore.getState().generateRotation({ bookingId: booking.id, ...input })
            const placed = useStore.getState().highlightIds.length
            setToast(`${placed} session${placed === 1 ? '' : 's'} filled in.`, true)
          }}
          onAddToList={(ids) => {
            useStore.getState().pickActivities(ids)
            setToast(
              `${ids.length} activit${ids.length === 1 ? 'y' : 'ies'} at the top of the list — drag them onto the grid.`,
            )
          }}
          onClose={() => setRotationOpen(false)}
        />
      )}

      {importOpen && (
        <ImportDialog
          site={doc.site}
          catalogue={activityList}
          onImport={(result) => {
            useStore.getState().importStays({
              bookings: result.bookings.map((entry) => entry.booking),
              blocks: result.bookings.flatMap((entry) => entry.blocks),
              activities: result.newActivities,
            })
            const sessions = result.bookings.reduce((total, entry) => total + entry.blocks.length, 0)
            setToast(
              `Imported ${result.bookings.length} school${result.bookings.length === 1 ? '' : 's'} and ${sessions} sessions.`,
              true,
            )
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {editingBooking && (
        <BookingDialog
          key={editingBooking.booking.id}
          booking={editingBooking.booking}
          isNew={editingBooking.isNew}
          blocks={doc.blocks.filter((b) => b.bookingId === editingBooking.booking.id)}
          onSave={(next) => {
            if (editingBooking.isNew) {
              useStore.getState().addBooking(next)
              setToast(`${next.schoolName} added — pick a day and start planning.`)
            } else {
              useStore.getState().saveBooking(next.id, next)
            }
          }}
          onDelete={() => deleteSchool(editingBooking.booking)}
          onClose={() => setEditingBooking(null)}
        />
      )}

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-[300] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2 pr-2 pl-3 text-[12.5px] shadow-[var(--shadow-lg)]"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[var(--brand)]"
              onClick={() => {
                useStore.getState().undo()
                setToastState(null)
              }}
            >
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The earliest start in a group's day with room for `duration` minutes.
 *
 * Inside a day that already has meals and logistics, that's the first gap long
 * enough; failing that, straight after the last thing on the day. An empty day
 * starts at nine, or the first hour shown if that's later.
 */
function firstFreeStart(
  blocks: Block[],
  duration: number,
  hours: { dayStart: number; dayEnd: number },
): number | null {
  if (blocks.length === 0) {
    const start = Math.max(hours.dayStart, 9 * 60)
    return start + duration <= hours.dayEnd ? start : hours.dayStart
  }
  const gap = suggestSlots(blocks, { ...hours, minLength: duration, maxLength: duration })[0]
  if (gap) return gap.startMin
  const last = Math.max(...blocks.map((b) => b.endMin))
  return last + duration <= hours.dayEnd ? last : null
}
