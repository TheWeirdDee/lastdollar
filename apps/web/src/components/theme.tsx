'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { ThemeProvider as NextThemes, useTheme } from 'next-themes'
import { useSyncExternalStore, type ReactNode } from 'react'
import { cx } from './ui'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="lastdollar-theme">
      {children}
    </NextThemes>
  )
}

const noop = () => () => {}
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false)
}

const options = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

/** Three-way theme switch with radio-group semantics. */
export function ThemeSwitch({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current = mounted ? (theme ?? 'system') : undefined
  return (
    <div role="radiogroup" aria-label="Theme" className={cx('inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5', className)}>
      {options.map(({ value, label, Icon }) => {
        const selected = current === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={cx(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-full text-muted transition-colors hover:text-text',
              showLabels ? 'px-2.5 text-xs font-medium' : 'w-7',
              selected && 'bg-surface-2 text-text',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {showLabels ? label : null}
          </button>
        )
      })}
    </div>
  )
}
