'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from './status'
import type { TxRecord } from '@/lib/history'
import { formatTime, shortAddress, shortHash, usd } from '@/lib/format'

const kindLabel = { exact: 'Exact', max: 'Send max', batch: 'Batch' } as const

export function HistoryList({ records }: { records: TxRecord[] }) {
  return (
    <ul className="divide-y divide-border">
      {records.map((r) => (
        <li key={r.hash}>
          <Link href={`/app/transactions/${r.hash}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {kindLabel[r.kind]} · {r.mode === 'native' ? 'Native' : 'ERC-20'}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {r.recipients.length === 1 ? `To ${shortAddress(r.recipients[0]!.recipient)}` : `${r.recipients.length} recipients`} · {formatTime(r.createdAt)} ·{' '}
                <span className="font-mono">{shortHash(r.hash)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-sm font-semibold">{usd(r.total18)}</p>
              <p className="tabular text-xs text-muted">{r.actualFee18 ? `fee ${usd(r.actualFee18)}` : 'USDC'}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
