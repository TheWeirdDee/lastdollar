import { ArrowDownRight, CircleAlert, CircleCheck, Info, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, cx } from './ui'
import { usd, usdExact } from '@/lib/format'

export interface QuoteView {
  kind: 'exact' | 'max' | 'batch'
  mode: 'native' | 'erc20'
  recipients: { address: string; amount18: bigint; reference?: string | undefined }[]
  recipientTotal18: bigint
  estimatedFee18?: bigint | undefined
  maxFeeBudget18?: bigint | undefined
  maxDebit18: bigint
  balance18: bigint
  estimatedRemaining18: bigint
  minimumRemaining18: bigint
  gasLimit?: bigint | undefined
  status: 'ready' | 'blocked'
  blockers?: string[]
  warnings?: string[]
}

const kindLabel = { exact: 'Exact payment', max: 'Send maximum', batch: 'Atomic batch' } as const
const modeLabel = { native: 'Native USDC', erc20: 'ERC-20 USDC' } as const

export function QuoteSummary({ view, sampleLabel, footer, className }: { view: QuoteView; sampleLabel?: string; footer?: ReactNode; className?: string }) {
  const single = view.recipients.length === 1 ? view.recipients[0] : undefined
  return (
    <section aria-label="Payment review" className={cx('rounded-2xl border border-border bg-surface shadow-soft', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{kindLabel[view.kind]}</p>
          <p className="text-xs text-muted">
            {modeLabel[view.mode]} on Arc{view.kind === 'batch' ? ' · one transaction, no token approval' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sampleLabel ? <Badge tone="warning">{sampleLabel}</Badge> : null}
          {view.status === 'ready' ? (
            <Badge tone="success" icon={<CircleCheck className="size-3" aria-hidden />}>
              Ready to review
            </Badge>
          ) : (
            <Badge tone="danger" icon={<CircleAlert className="size-3" aria-hidden />}>
              Blocked
            </Badge>
          )}
        </div>
      </header>

      <div className="px-5 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{view.kind === 'batch' ? `${view.recipients.length} recipients receive` : 'Recipient receives'}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="tabular text-[2.25rem] font-semibold leading-none tracking-[-0.03em]">{usd(view.recipientTotal18)}</span>
          <span className="text-sm font-medium text-muted">USDC</span>
        </p>
        {single ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
            <ArrowDownRight className="size-4" aria-hidden />
            to <span className="break-all font-mono text-text" aria-label={`Full recipient address ${single.address}`}>{single.address}</span>
          </p>
        ) : null}
        {view.kind === 'max' && view.recipientTotal18 % 1_000_000_000_000n !== 0n ? (
          <p className="mt-1 text-xs text-muted tabular">Exact: {usdExact(view.recipientTotal18)} USDC</p>
        ) : null}
      </div>

      {view.kind === 'batch' ? (
        <ol className="mx-5 mt-4 max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {view.recipients.map((r, i) => (
            <li key={`${r.address}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted tabular">{i + 1}</span>
                <span className="break-all font-mono text-xs" aria-label={`Full recipient ${i + 1} address ${r.address}`}>{r.address}</span>
              </span>
              <span className="tabular shrink-0 text-right">{usdExact(r.amount18)}<span className="block text-xs text-muted">USDC</span></span>
            </li>
          ))}
        </ol>
      ) : null}

      <dl className="mx-5 mt-4 divide-y divide-border border-y border-border">
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-sm text-muted">Estimated network fee</dt>
          <dd className="tabular text-right text-sm whitespace-nowrap">{view.estimatedFee18 === undefined ? 'Unavailable' : `${usd(view.estimatedFee18)} USDC`}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-sm text-muted">
            Maximum fee budget
            <span className="block text-xs">The most this transaction can be charged</span>
          </dt>
          <dd className="tabular text-right text-sm whitespace-nowrap">{view.maxFeeBudget18 === undefined ? 'Unavailable' : `${usd(view.maxFeeBudget18)} USDC`}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-sm font-medium">Maximum total debit</dt>
          <dd className="tabular text-right text-sm font-semibold whitespace-nowrap">{usd(view.maxDebit18)} USDC</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-sm text-muted">
            Remaining balance
            <span className="block text-xs">Estimated · at least</span>
          </dt>
          <dd className="tabular text-right text-sm whitespace-nowrap">
            {usd(view.estimatedRemaining18)} USDC
            <span className="block text-xs text-muted">{usd(view.minimumRemaining18)} USDC</span>
          </dd>
        </div>
      </dl>

      <div className="space-y-2 px-5 py-4">
        {(view.blockers ?? []).map((b) => (
          <p key={b} className="flex gap-2 text-sm text-danger" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {b}
          </p>
        ))}
        {(view.warnings ?? []).map((w) => (
          <p key={w} className="flex gap-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {w}
          </p>
        ))}
        <p className="flex gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Conditions are rechecked immediately before your wallet asks you to sign. If anything material changes, you review again.
        </p>
      </div>
      {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
    </section>
  )
}
