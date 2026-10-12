'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { cx } from '@/components/ui'

export function DocsNav({ docs }: { docs: { slug: string; title: string }[] }) {
  const pathname = usePathname()
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (details.current) details.current.open = false
  }, [pathname])

  const links = (
    <ul className="space-y-0.5">
      <li>
        <Link
          href="/docs"
          aria-current={pathname === '/docs' ? 'page' : undefined}
          className={cx('block rounded-lg px-3 py-2 text-sm', pathname === '/docs' ? 'bg-surface-2 font-medium' : 'text-muted hover:text-text')}
        >
          Overview
        </Link>
      </li>
      {docs.map((d) => {
        const href = `/docs/${d.slug}`
        const active = pathname === href
        return (
          <li key={d.slug}>
            <Link href={href} aria-current={active ? 'page' : undefined} className={cx('block rounded-lg px-3 py-2 text-sm', active ? 'bg-surface-2 font-medium' : 'text-muted hover:text-text')}>
              {d.title}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      <details ref={details} className="group rounded-xl border border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Documentation menu
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <nav aria-label="Documentation" className="border-t border-border p-2">
          {links}
        </nav>
      </details>
      <nav aria-label="Documentation" className="hidden lg:block">
        <div className="sticky top-24">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Documentation</p>
          {links}
        </div>
      </nav>
    </>
  )
}
