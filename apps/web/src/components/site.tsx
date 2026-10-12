'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Logo } from './brand'
import { ThemeSwitch } from './theme'
import { ButtonLink, cx } from './ui'
import { REPO_URL } from '@/lib/network'

const NAV = [
  { href: '/#product', label: 'Product' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/proof', label: 'Proof' },
  { href: '/developers', label: 'Developers' },
]

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  // Close the sheet when navigation completes; Radix restores focus to the trigger.
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      setOpen(false)
    }
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-text">
              {n.label}
            </Link>
          ))}
          <a href={REPO_URL} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-text">
            <GitHubMark className="size-4" />
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden sm:contents">
            <ThemeSwitch />
            <ButtonLink href="/app" size="sm">
              Open app
            </ButtonLink>
          </span>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface md:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
              <Dialog.Content className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-border bg-bg px-4 pb-6 pt-3 shadow-soft focus:outline-none">
                <div className="flex h-12 items-center justify-between">
                  <Dialog.Title className="sr-only">Menu</Dialog.Title>
                  <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
                  <Logo />
                  <Dialog.Close asChild>
                    <button type="button" className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface" aria-label="Close menu">
                      <X className="size-5" aria-hidden />
                    </button>
                  </Dialog.Close>
                </div>
                <nav aria-label="Mobile" className="mt-4 flex flex-col">
                  {NAV.map((n) => (
                    <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="border-b border-border py-3.5 text-base font-medium">
                      {n.label}
                    </Link>
                  ))}
                  <a href={REPO_URL} className="flex items-center gap-2 border-b border-border py-3.5 text-base font-medium">
                    <GitHubMark className="size-4" /> GitHub
                  </a>
                </nav>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">Theme</span>
                  <ThemeSwitch showLabels />
                </div>
                <ButtonLink href="/app" size="lg" className="mt-5 w-full" onClick={() => setOpen(false)}>
                  Open app <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const cols: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
      title: 'Product',
      links: [
        { href: '/app', label: 'Open app' },
        { href: '/app/send', label: 'Send' },
        { href: '/app/batch', label: 'Batch' },
        { href: '/proof', label: 'Mainnet proof' },
      ],
    },
    {
      title: 'Developers',
      links: [
        { href: '/developers', label: 'Overview' },
        { href: '/docs', label: 'Documentation' },
        { href: '/docs/sdk', label: 'SDK reference' },
        { href: REPO_URL, label: 'Source on GitHub', external: true },
      ],
    },
    {
      title: 'Trust',
      links: [
        { href: '/security', label: 'Security' },
        { href: '/privacy', label: 'Privacy' },
        { href: '/docs/payment-math', label: 'Payment math' },
        { href: '/security#limitations', label: 'Limitations' },
      ],
    },
  ]
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Open-source, non-custodial USDC payment tooling for Arc. Payments are authorised and signed in your own wallet. Not audited; see the security page before moving
            significant funds.
          </p>
          <ThemeSwitch showLabels />
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.href} className="text-sm text-muted hover:text-text">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-muted hover:text-text">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>MIT licensed. LastDollar is an independent project and is not affiliated with Circle or Arc.</p>
          <p>Network fees are paid in USDC and are never zero.</p>
        </div>
      </div>
    </footer>
  )
}

export function Reveal({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null)
  // Visible by default (no JS, crawlers, screenshots). Only content below the fold is hidden,
  // after mount, and revealed once when it scrolls into view.
  const [shown, setShown] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    // Defer hiding to the next frame so the observer cannot race the initial paint.
    const raf = requestAnimationFrame(() => {
      setShown(false)
      io.observe(el)
    })
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])
  return (
    <Tag ref={ref} data-shown={shown === undefined ? undefined : String(shown)} className={cx('reveal', className)}>
      {children}
    </Tag>
  )
}
