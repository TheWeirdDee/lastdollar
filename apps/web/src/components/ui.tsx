import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'

export { CopyButton, Segmented } from './ui-client'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-text border border-border hover:border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90 border border-transparent dark:text-[#0c0d0f]',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    extra,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  loadingText?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, loadingText, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cx('rounded-2xl border border-border bg-surface', className)} {...rest} />
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
}

export function Badge({ tone = 'neutral', className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function Callout({
  tone = 'neutral',
  title,
  children,
  icon,
  className,
  role,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  const border: Record<Tone, string> = {
    neutral: 'border-border bg-surface-2',
    accent: 'border-accent/30 bg-accent-soft',
    success: 'border-success/30 bg-success-soft',
    warning: 'border-warning/30 bg-warning-soft',
    danger: 'border-danger/30 bg-danger-soft',
  }
  const text: Record<Tone, string> = { neutral: 'text-text', accent: 'text-accent', success: 'text-success', warning: 'text-warning', danger: 'text-danger' }
  return (
    <div role={role} className={cx('flex gap-3 rounded-xl border p-3.5 text-sm', border[tone], className)}>
      {icon ? <span className={cx('mt-0.5 shrink-0 [&>svg]:size-4', text[tone])}>{icon}</span> : null}
      <div className="min-w-0 space-y-1">
        {title ? <p className={cx('font-medium', text[tone])}>{title}</p> : null}
        {children ? <div className="text-text/90 [&_a]:underline">{children}</div> : null}
      </div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin', className)} aria-hidden />
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[0.85em] break-all', className)}>{children}</span>
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  trailing,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string | undefined
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass = cx(
  'h-11 w-full min-w-0 rounded-[10px] border border-border bg-surface px-3 text-base text-text placeholder:text-muted/70',
  'transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-ring',
  'aria-[invalid=true]:border-danger disabled:opacity-60',
)

export function Row({ label, value, sub, strong, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 py-2', className)}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx('text-right tabular', strong ? 'text-base font-semibold' : 'text-sm')}>
        <div>{value}</div>
        {sub ? <div className="text-xs font-normal text-muted">{sub}</div> : null}
      </dd>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('inline-block animate-pulse rounded-md bg-surface-2', className)} aria-hidden />
}
