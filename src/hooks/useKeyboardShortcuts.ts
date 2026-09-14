import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Global shortcuts. Arrow keys nudge the selection on the time axis, which is
 * the accessible route to everything the drag gestures do.
 */
export function useKeyboardShortcuts(options: { onPrint: () => void }): void {
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
        options.onPrint()
        return
      }

      if (mod && event.key.toLowerCase() === 'd' && selected.length > 0) {
        event.preventDefault()
        store.duplicateBlocks(selected)
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length > 0) {
        event.preventDefault()
        store.removeBlocks(selected)
        return
      }

      if (event.key === 'Escape') {
        store.clearSelection()
        return
      }

      if (selected.length === 0) return

      const step = event.shiftKey ? 60 : store.prefs.snapMinutes

      // Alt + arrows resize the end; plain arrows move the whole block.
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const delta = event.key === 'ArrowUp' ? -step : step
        for (const id of selected) {
          const block = store.doc.blocks.find((b) => b.id === id)
          if (!block || block.locked) continue
          if (event.altKey) {
            const endMin = Math.max(block.startMin + 15, block.endMin + delta)
            store.updateBlock(id, { endMin })
          } else {
            store.updateBlock(id, {
              startMin: block.startMin + delta,
              endMin: block.endMin + delta,
            })
          }
        }
      }

      // Left/right move a block between group columns.
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        for (const id of selected) {
          const block = store.doc.blocks.find((b) => b.id === id)
          if (!block || block.locked || block.groupIds.length !== 1) continue
          const booking = store.doc.bookings.find((b) => b.id === block.bookingId)
          if (!booking) continue
          const index = booking.groups.findIndex((g) => g.id === block.groupIds[0])
          const next = booking.groups[index + direction]
          if (next) store.updateBlock(id, { groupIds: [next.id] })
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [options])
}
