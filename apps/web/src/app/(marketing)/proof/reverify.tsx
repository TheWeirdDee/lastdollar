'use client'

import { verifyPaymentReceipt } from '@lastdollar/arc'
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { usd } from '@/lib/format'
import { appNetwork, createAppReadClient } from '@/lib/network'

/** Re-reads a recorded proof transaction from the chain, in the reader's own browser. */
export function Reverify({ hash, fee18, delivered }: { hash: `0x${string}`; fee18: string; delivered: { recipient: string; amount18: string }[] }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | 'loading' | undefined>()
  return (
    <div className="flex flex-wrap items-center gap-3" aria-live="polite">
      <Button
        size="sm"
        variant="secondary"
        loading={state === 'loading'}
        loadingText="Reading chain"
        onClick={async () => {
          setState('loading')
          try {
            const client = createAppReadClient()
            const r = await verifyPaymentReceipt({ publicClient: client, hash, config: appNetwork })
            const same =
              r.actualFee18?.toString() === fee18 &&
              r.delivered.length === delivered.length &&
              r.delivered.every((d, i) => d.recipient.toLowerCase() === delivered[i]!.recipient.toLowerCase() && d.amount18.toString() === delivered[i]!.amount18)
            setState({
              ok: same,
              text: same
                ? `Matches chain data now: ${r.delivered.length} payout(s), fee ${usd(r.actualFee18)} USDC, block ${r.blockNumber}.`
                : `Chain data differs from the record (status ${r.status}).`,
            })
          } catch (e) {
            setState({ ok: false, text: `Could not read chain data: ${(e as Error).message}` })
          }
        }}
      >
        <RefreshCw className="size-3.5" aria-hidden /> Re-verify live
      </Button>
      {state && state !== 'loading' ? (
        <span className={`flex items-center gap-1.5 text-xs ${state.ok ? 'text-success' : 'text-danger'}`}>
          {state.ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
          {state.text}
        </span>
      ) : null}
    </div>
  )
}
