'use client'

import { ChevronDown, RefreshCw } from 'lucide-react'
import type { BalanceSnapshot } from '@lastdollar/arc'
import { Card, Skeleton, cx } from './ui'
import { usd, usdExact } from '@/lib/format'

export function BalanceCard({
  balance,
  loading,
  error,
  onRefresh,
  refreshing,
  className,
}: {
  balance: BalanceSnapshot | undefined
  loading: boolean
  error?: string | undefined
  onRefresh?: () => void
  refreshing?: boolean
  className?: string
}) {
  return (
    <Card className={cx('p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">USDC balance</p>
          <div className="mt-1 flex items-baseline gap-2" aria-live="polite">
            {loading ? (
              <Skeleton className="h-10 w-40" />
            ) : error ? (
              <span className="text-base font-medium text-danger">Unavailable</span>
            ) : (
              <>
                <span className="tabular text-[2.5rem] font-semibold leading-none tracking-[-0.03em]">{usd(balance?.native18, 6)}</span>
                <span className="text-sm font-medium text-muted">USDC</span>
              </>
            )}
          </div>
          {error ? <p className="mt-2 text-sm text-muted">{error} Balances are never estimated or cached when the network is unreachable.</p> : null}
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Refresh balance"
          >
            <RefreshCw className={cx('size-4', refreshing && 'animate-spin')} aria-hidden />
          </button>
        ) : null}
      </div>
      {balance ? (
        <details className="group mt-4 rounded-xl border border-border bg-bg/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted [&::-webkit-details-marker]:hidden">
            Technical details: one balance, two views
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <dl className="space-y-2 border-t border-border px-3 py-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Native view (18 decimals)</dt>
              <dd className="tabular text-right font-mono break-all">{usdExact(balance.native18)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">ERC-20 view (6 decimals)</dt>
              <dd className="tabular text-right font-mono">{usd(balance.token6 * 10n ** 12n)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Below one micro-USDC</dt>
              <dd className="tabular text-right font-mono">{usdExact(balance.subMicro18)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Read at block</dt>
              <dd className="tabular text-right font-mono">{balance.blockNumber.toString()}</dd>
            </div>
            <p className="pt-1 leading-relaxed text-muted">
              These are the same funds, never added together. The ERC-20 view truncates the native balance{balance.viewsConsistent ? ', and the two agree at this block.' : '. At this block they disagree, so payments are treated with extra caution.'}
            </p>
          </dl>
        </details>
      ) : null}
    </Card>
  )
}
