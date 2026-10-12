import { CopyButton, cx } from './ui'

export function CodeBlock({ code, title, className }: { code: string; title?: string; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-2xl border border-border bg-surface-2', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="font-mono text-xs text-muted">{title ?? 'TypeScript'}</span>
        <CopyButton value={code} label="Copy code" />
      </div>
      <pre tabIndex={0} aria-label={`${title ?? 'Code'} example`} className="overflow-x-auto p-4 text-[0.8125rem] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
