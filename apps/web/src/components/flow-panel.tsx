'use client'

import type { PaymentQuote } from '@lastdollar/arc'
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, ExternalLink, FileSearch, Loader2, RefreshCcw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { QuoteSummary, type QuoteView } from './quote-summary'
import { Button, ButtonLink, Callout, Card, cx } from './ui'
import { shortHash, txUrl, usd } from '@/lib/format'
import { isTestMode } from '@/lib/network'
import { statusCopy } from '@/lib/use-payment-flow'

export function toView(q: PaymentQuote): QuoteView {
  return {
    kind: q.kind,
    mode: q.mode,
    recipients: q.lines.map((l) => ({ address: l.recipient, amount18: l.amount18, reference: l.reference })),
    recipientTotal18: q.recipientTotal18,
    estimatedFee18: q.fee?.estimatedFee18,
    maxFeeBudget18: q.fee?.maxFeeBudget18,
    maxDebit18: q.maxDebit18,
    balance18: q.balance.native18,
    estimatedRemaining18: q.estimatedRemaining18,
    minimumRemaining18: q.minimumRemaining18,
    gasLimit: q.fee?.gasLimit,
    status: q.status,
    blockers: q.blockers.map((b) => b.message),
    warnings: q.warnings.filter((w) => w.code !== 'TEST_NETWORK').map((w) => w.message),
  }
}

const ORDER = ['revalidating', 'awaiting-signature', 'submitted', 'confirming', 'reconciling'] as const

function Timeline({ status, hash }: { status: string; hash?: string | undefined }) {
  const current = status === 'replaced' ? ORDER.indexOf('confirming') : ORDER.indexOf(status as (typeof ORDER)[number])
  return (
    <ol className="space-y-3" aria-label="Payment progress">
      {ORDER.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            {done ? (
              <CheckCircle2 className="size-4 text-success" aria-hidden />
            ) : active ? (
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
            ) : (
              <CircleDashed className="size-4 text-muted" aria-hidden />
            )}
            <span className={cx(active ? 'font-medium text-text' : done ? 'text-text' : 'text-muted')}>{statusCopy[s]}</span>
            <span className="sr-only">{done ? '(done)' : active ? '(in progress)' : '(pending)'}</span>
          </li>
        )
      })}
      {hash ? (
        <li className="pt-1 text-xs text-muted">
          Transaction <span className="font-mono">{shortHash(hash)}</span>, saved to this browser&apos;s history so it can be recovered after a refresh.
        </li>
      ) : null}
    </ol>
  )
}

export function FlowPanel({
  flow,
  onRefreshQuote,
  editLabel = 'Edit payment',
}: {
  flow: ReturnType<typeof import('@/lib/use-payment-flow').usePaymentFlow>
  onRefreshQuote: () => void
  editLabel?: string
}) {
  const { state } = flow
  const [checked, setChecked] = useState(false)

  if (state.step === 'quoting') {
    return (
      <Card className="flex items-center gap-3 p-6 text-sm text-muted" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Reading your balance, estimating the exact call and simulating it…
      </Card>
    )
  }

  if (state.step === 'quote-error') {
    return (
      <Callout tone="danger" role="alert" icon={<CircleAlert />} title="Could not prepare a quote">
        <p>{state.error.message}</p>
        <p className="mt-1 text-xs text-muted">Code: {state.error.code}</p>
      </Callout>
    )
  }

  if (state.step === 'quoted') {
    const q = state.quote
    return (
      <QuoteSummary
        view={toView(q)}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={onRefreshQuote}>
              <RefreshCcw className="size-4" aria-hidden /> Refresh quote
            </Button>
            <Button onClick={() => { setChecked(false); flow.review() }} disabled={q.status !== 'ready'}>
              Review payment
            </Button>
          </div>
        }
      />
    )
  }

  if (state.step === 'review') {
    const q = state.plan.quote
    const many = q.lines.length > 1
    return (
      <div className="space-y-4">
        {state.notice ? (
          <Callout tone="warning" role="status" icon={<AlertTriangle />}>
            {state.notice}
          </Callout>
        ) : null}
        <QuoteSummary
          view={toView(q)}
          footer={
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                <span>
                  I checked {many ? `all ${q.lines.length} recipients and amounts` : 'the recipient address and amount'}. Arc payments cannot be reversed.
                  {isTestMode ? ' (Test chain: nothing real is sent.)' : ''}
                </span>
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={flow.backToEdit}>
                  <ArrowLeft className="size-4" aria-hidden /> {editLabel}
                </Button>
                <Button onClick={() => flow.sign(state.plan)} disabled={!checked}>
                  Recheck and sign in wallet
                </Button>
              </div>
            </div>
          }
        />
      </div>
    )
  }

  if (state.step === 'changed') {
    return (
      <Card className="space-y-4 p-5" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <h2 className="font-semibold">Conditions changed before signing</h2>
            <p className="mt-1 text-sm text-muted">Nothing was sent. Review the updated terms; they apply only if you continue.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">What changed</th>
                <th className="px-3 py-2 font-medium">Reviewed</th>
                <th className="px-3 py-2 font-medium">Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {state.changes.map((c) => (
                <tr key={c.field}>
                  <td className="px-3 py-2 font-medium">{c.field}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all text-muted">{c.before}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.fresh.status !== 'ready' ? (
          <Callout tone="danger" icon={<CircleAlert />} title="The payment can no longer be made as requested">
            {state.fresh.blockers.map((b) => b.message).join(' ')}
          </Callout>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={flow.backToEdit}>
            <ArrowLeft className="size-4" aria-hidden /> Start over
          </Button>
          <Button onClick={() => { setChecked(false); flow.acceptChanges() }}>Review updated terms</Button>
        </div>
      </Card>
    )
  }

  if (state.step === 'executing') {
    return (
      <Card className="p-5" aria-live="polite">
        <h2 className="font-semibold">Payment in progress</h2>
        <p className="mt-1 text-sm text-muted">Keep this tab open. If you close it, the payment is still tracked in History.</p>
        <div className="mt-5">
          <Timeline status={state.status} hash={state.hash} />
        </div>
      </Card>
    )
  }

  if (state.step === 'done') {
    const r = state.result.receipt
    const ok = r.status === 'verified'
    const budget = r.comparison?.maxFeeBudget18
    const overBudget = r.comparison?.feeWithinBudget === false && budget !== undefined && r.actualFee18 !== undefined
    return (
      <Card className="space-y-4 p-5" aria-live="polite">
        <div className="flex items-start gap-3">
          {ok && overBudget ? (
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
          ) : ok ? (
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {ok ? (overBudget ? 'Delivered, but the fee exceeded the reviewed maximum' : 'Payment verified') : r.status === 'reverted' ? 'Transaction reverted' : 'Receipt needs attention'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {ok
                ? 'The receipt shows every recipient received exactly the reviewed amount.'
                : r.status === 'reverted'
                  ? 'The transaction was included but reverted. No recipient was paid; the network fee was still charged.'
                  : 'The transaction succeeded, but its transfers do not match what you reviewed. Check the receipt details.'}
            </p>
          </div>
        </div>
        <dl className="divide-y divide-border rounded-xl border border-border px-4">
          <div className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-muted">Delivered</dt>
            <dd className="tabular">{usd(r.deliveredTotal18)} USDC</dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-muted">Actual network fee</dt>
            <dd className="tabular">{usd(r.actualFee18)} USDC</dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-muted">Quoted maximum fee</dt>
            <dd className="tabular">{usd(r.comparison?.maxFeeBudget18)} USDC</dd>
          </div>
          {overBudget ? (
            <div className="py-2.5 text-sm text-danger" role="alert">
              The network fee was {usd(r.actualFee18! - budget!)} USDC above the maximum you reviewed. This usually means the wallet changed the gas settings.
            </div>
          ) : null}
          {r.comparison?.walletModifiedParameters ? (
            <div className="py-2.5 text-sm text-warning">Your wallet changed: {r.comparison.modifiedFields.join(', ')}.</div>
          ) : null}
        </dl>
        {r.issues.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
            {r.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/app/transactions/${state.result.finalHash}`} variant="secondary">
            <FileSearch className="size-4" aria-hidden /> Full receipt
          </ButtonLink>
          {!isTestMode ? (
            <a href={txUrl(state.result.finalHash)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium text-accent hover:bg-surface-2">
              Explorer <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
          <Button variant="ghost" className="sm:ml-auto" onClick={flow.reset}>
            New payment
          </Button>
        </div>
      </Card>
    )
  }

  if (state.step === 'failed') {
    const unresolved = state.error.code === 'RECEIPT_TIMEOUT' || (state.hash && state.error.code === 'RPC_UNAVAILABLE')
    return (
      <Card className="space-y-4 p-5" role="alert">
        <div className="flex items-start gap-3">
          {unresolved ? <CircleDashed className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden /> : <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />}
          <div>
            <h2 className="text-lg font-semibold">{unresolved ? 'Outcome not known yet' : 'Payment not completed'}</h2>
            <p className="mt-1 text-sm text-muted">{state.error.message}</p>
            <p className="mt-1 text-xs text-muted">Code: {state.error.code}</p>
          </div>
        </div>
        {state.hash ? (
          <Callout tone={unresolved ? 'warning' : 'neutral'}>
            A transaction was broadcast: <span className="font-mono">{shortHash(state.hash)}</span>. It is tracked in{' '}
            <Link href="/app/history" className="underline">
              History
            </Link>
            . Do not send again until its outcome is known.
          </Callout>
        ) : (
          <p className="text-sm text-muted">Nothing was broadcast, so no fee was charged.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {state.hash ? (
            <ButtonLink href={`/app/transactions/${state.hash}`} variant="secondary">
              Check receipt
            </ButtonLink>
          ) : null}
          <Button variant="ghost" onClick={flow.reset}>
            Start over
          </Button>
        </div>
      </Card>
    )
  }

  return null
}
