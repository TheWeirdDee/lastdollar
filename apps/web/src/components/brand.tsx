import Link from 'next/link'
import { cx } from './ui'

/** Original LastDollar mark: an "L" stroke with the last unit as a coin dot at its open end. */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx('size-7 shrink-0', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M10.5 8.5v14h11" fill="none" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21.5" cy="11.5" r="3" fill="var(--accent-fg)" />
    </svg>
  )
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cx('inline-flex items-center gap-2 rounded-lg', className)} aria-label="LastDollar home">
      <Mark />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.03em]">LastDollar</span>
    </Link>
  )
}
