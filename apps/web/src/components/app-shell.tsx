'use client'

import { FlaskConical, History, LayoutGrid, Layers, Send } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Logo } from './brand'
import { ThemeSwitch } from './theme'
import { cx } from './ui'
import { NetworkPill, WalletButton, WrongNetworkBanner } from './wallet'
import { pruneReviewSnapshots } from '@/lib/history'
import { isTestMode } from '@/lib/network'
import { usePendingWatcher } from '@/lib/use-arc'

const TABS = [
  { href: '/app', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/app/send', label: 'Send', icon: Send },
  { href: '/app/batch', label: 'Batch', icon: Layers },
  { href: '/app/history', label: 'History', icon: History },
]

function useActive() {
  const pathname = usePathname()
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
}

export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useActive()
  usePendingWatcher()
  // Enforce the 30-day review snapshot expiry whenever the app opens.
  useEffect(() => {
    try {
      pruneReviewSnapshots()
    } catch {
      /* storage unavailable */
    }
  }, [])
  return (
    <div className="flex min-h-dvh flex-col">
      {isTestMode ? (
        <div className="bg-warning text-center text-xs font-medium text-bg">
          <p className="mx-auto flex max-w-[1200px] items-center justify-center gap-1.5 px-4 py-1.5">
            <FlaskConical className="size-3.5" aria-hidden />
            Test network. This build is connected to a local test chain, not Arc mainnet. Nothing here is real.
          </p>
        </div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Logo href="/" />
            <nav aria-label="App" className="hidden items-center gap-1 md:flex">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={isActive(t.href, t.exact) ? 'page' : undefined}
                  className={cx(
                    'rounded-lg px-2.5 py-1.5 text-sm transition-colors lg:px-3',
                    isActive(t.href, t.exact) ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:text-text',
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden lg:contents">
              <NetworkPill />
              <ThemeSwitch />
            </span>
            <WalletButton />
          </div>
        </div>
      </header>
      <WrongNetworkBanner />
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-16 md:pt-10 lg:px-8">
        {children}
      </main>
      <footer className="hidden border-t border-border md:block">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 text-xs text-muted sm:px-6 lg:px-8">
          <p>Non-custodial. Your wallet signs every payment. History is stored only in this browser.</p>
          <div className="flex items-center gap-4">
            <Link href="/proof" className="hover:text-text">
              Proof
            </Link>
            <Link href="/docs" className="hover:text-text">
              Docs
            </Link>
            <Link href="/security" className="hover:text-text">
              Security
            </Link>
            <ThemeSwitch className="lg:hidden" />
          </div>
        </div>
      </footer>
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {TABS.map((t) => {
            const active = isActive(t.href, t.exact)
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium', active ? 'text-accent' : 'text-muted')}
                >
                  <t.icon className="size-5" aria-hidden />
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
