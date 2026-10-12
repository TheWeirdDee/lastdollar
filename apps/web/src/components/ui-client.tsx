'use client'

import { Check, Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={cx('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  )
}

/** A labelled radio group rendered as a segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  name,
  disabled,
  className,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; description?: string; icon?: ReactNode }[]
  name: string
  disabled?: boolean
  className?: string
}) {
  return (
    <fieldset className={cx('min-w-0', className)} disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid gap-1 rounded-xl border border-border bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const id = `${name}-${o.value}`
          const selected = o.value === value
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cx(
                'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                selected ? 'bg-surface text-text shadow-soft' : 'text-muted hover:text-text',
              )}
            >
              <input id={id} type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
              {o.icon}
              <span className="truncate">{o.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

