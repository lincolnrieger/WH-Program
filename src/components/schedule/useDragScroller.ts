import { useCallback, useRef } from 'react'
import { registerScroller } from '@/store/dragStore'

/**
 * Marks a scrolling container as one the drag controller may move.
 *
 * Without it, a week of schools is only as draggable as the screen is wide:
 * you pick a session up on Friday and there is no way to reach Monday while
 * still holding it. With it, pushing towards an edge scrolls the view under
 * the pointer, faster the closer you get — and the drop preview keeps up,
 * because the controller re-resolves the target on every scrolled frame.
 *
 * Returns a callback ref to put on the scrolling element.
 */
export function useDragScroller<T extends HTMLElement = HTMLDivElement>() {
  const release = useRef<(() => void) | null>(null)

  return useCallback((element: T | null) => {
    release.current?.()
    release.current = element ? registerScroller(element) : null
  }, [])
}
