import { useEffect, type ReactNode } from 'react'
import { IconButton } from './primitives'

/** Centred dialog with a scrim, Escape to close and focus trapped to the panel. */
export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
  width = 520,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  width?: number
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        style={{ maxWidth: width }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{description}</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose}>
            &#10005;
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
