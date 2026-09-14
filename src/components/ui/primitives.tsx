import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'default', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap ' +
    'transition-colors disabled:opacity-45 disabled:pointer-events-none select-none'
  const sizes = size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-3 text-[13px]'

  const variants: Record<string, string> = {
    primary: 'text-[var(--brand-ink)] bg-[var(--brand)] hover:brightness-110',
    default:
      'text-[var(--ink)] bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-sunk)]',
    ghost: 'text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)] hover:text-[var(--ink)]',
    danger: 'text-[var(--danger)] bg-[var(--danger-tint)] hover:brightness-95',
  }

  return <button type="button" className={cx(base, sizes, variants[variant], className)} {...rest} />
}

export function IconButton({
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-soft)]',
        'transition-colors hover:bg-[var(--surface-sunk)] hover:text-[var(--ink)]',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
      {...rest}
    />
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5',
        'text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)]',
        'focus:border-[var(--brand-soft)] focus:outline-none',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2',
        'text-[13px] text-[var(--ink)] focus:border-[var(--brand-soft)] focus:outline-none',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
      <h2 className="text-[11px] font-semibold tracking-wider text-[var(--ink-faint)] uppercase">
        {children}
      </h2>
      {right}
    </div>
  )
}

export function Chip({
  children,
  colour,
  onClick,
  active,
  title,
}: {
  children: ReactNode
  colour?: string
  onClick?: () => void
  active?: boolean
  title?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        onClick && 'cursor-pointer transition-colors hover:brightness-95',
        active
          ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]',
      )}
    >
      {colour && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: colour }}
        />
      )}
      {children}
    </Tag>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      <p className="max-w-sm text-[13px] text-[var(--ink-soft)]">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
