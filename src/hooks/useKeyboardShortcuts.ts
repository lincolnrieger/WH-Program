import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Global shortcuts. Arrow keys nudge the selection on the time axis, which is
 * the accessible route to everything the drag gestures do.
 */
export function useKeyboardShortcuts(options: {
  onPrint: () => void
  /** Deletes the selection; the app owns it so it can offer an undo. */
  onDelete: (ids: string[]) => void
}): void {
  // Read through a ref so the listener is added once, not on every render.
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (typing) return

      const store = useStore.getState()
      const selected = store.selection.blockIds
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }

      if (mod && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        optionsRef.current.onPrint()
        return
      }

      if (mod && event.key.toLowerCase() === 'd' && selected.length > 0) {
        event.preventDefault()
        store.duplicateBlocks(selected)
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length > 0) {
        event.preventDefault()
        optionsRef.current.onDelete(selected)
        return
      }

      if (event.key === 'Escape') {
        store.clearSelection()
        return
      }

      if (selected.length === 0) return

      const step = event.shiftKey ? 60 : store.prefs.snapMinutes

      // Alt + arrows resize the end; plain arrows move the whole block. Every
      // selected block moves in one step, so one Ctrl+Z puts them all back.
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const delta = event.key === 'ArrowUp' ? -step : step
        store.updateEach(selected, (block) => {
          if (block.locked) return null
          if (event.altKey) return { endMin: Math.max(block.startMin + 15, block.endMin + delta) }
          return { startMin: block.startMin + delta, endMin: block.endMin + delta }
        })
      }

      // Left/right move a block between group columns.
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        store.updateEach(selected, (block) => {
          if (block.locked || block.groupIds.length !== 1) return null
          const booking = store.doc.bookings.find((b) => b.id === block.bookingId)
          if (!booking) return null
          const index = booking.groups.findIndex((g) => g.id === block.groupIds[0])
          const next = booking.groups[index + direction]
          return next ? { groupIds: [next.id] } : null
        })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
