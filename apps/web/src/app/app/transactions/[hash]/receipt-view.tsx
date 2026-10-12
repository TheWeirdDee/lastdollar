'use client'

import { verifyPaymentReceipt, type ReconciledPayment } from '@lastdollar/arc'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, ExternalLink, FileQuestion, Info, Loader2, RefreshCw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '@/components/status'
import { Badge, Button, Callout, Card, CopyButton, cx } from '@/components/ui'
import { useRecordByHash } from '@/lib/history'
import { addressUrl, formatTime, gweiString, shortAddress, txUrl, usd, usdExact } from '@/lib/format'
import { appNetwork, isTestMode } from '@/lib/network'
import { useArcPublicClient } from '@/lib/use-arc'

const opLabel: Record<ReconciledPayment['operation'], string> = {
  'native-transfer': 'Native USDC transfer',
  'erc20-transfer': 'ERC-20 USDC transfer',
  'splitter-batch': 'LastDollar atomic batch',
  unknown: 'Not a recognised USDC payment',
}

function Headline({ r }: { r: ReconciledPayment }) {
  if (r.status === 'pending')
    return (
      <div className="flex items-center gap-2 text-accent">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <span className="font-semibold">Pending: no receipt yet</span>
      </div>
    )
  if (r.status === 'reverted')
    return (
      <div className="flex items-center gap-2 text-danger">
        <XCircle className="size-5" aria-hidden />
        <span className="font-semibold">Reverted: no value was delivered, the fee was charged</span>
      </div>
    )
  if (r.status === 'not-found')
    return (
      <div className="flex items-center gap-2 text-warning">
        <FileQuestion className="size-5" aria-hidden />
        <span className="font-semibold">Not found on {appNetwork.name}</span>
      </div>
    )
  return (
    <div className="flex items-center gap-2 text-success">
      <CheckCircle2 className="size-5" aria-hidden />
      <span className="font-semibold">Executed successfully</span>
    </div>
  )
}

export function ReceiptView({ hash }: { hash: `0x${string}` }) {
  const publicClient = useArcPublicClient()
  const record = useRecordByHash(hash)

  const q = useQuery({
    queryKey: ['receipt', appNetwork.chainId, hash],
    queryFn: () => verifyPaymentReceipt({ publicClient, hash, config: appNetwork }),
    enabled: !!publicClient,
    refetchInterval: (query) => (query.state.data?.status === 'pending' || query.state.data?.status === 'not-found' ? 4_000 : false),
  })
  const r = q.data

  // Compare chain data with the locally recorded intent (metadata, not evidence).
  const intended = record?.recipients ?? []
  const lineMatch = (i: number) => {
    const d = r?.delivered[i]
    const e = intended[i]
    return !!d && !!e && d.recipient.toLowerCase() === e.recipient.toLowerCase() && d.amount18.toString() === e.amount18
  }
  const allMatch = !!r && intended.length > 0 && r.delivered.length === intended.length && intended.every((_, i) => lineMatch(i))

  return (
    <div className="space-y-6">
      <Link href="/app/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> History
      </Link>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Receipt</h1>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs text-muted">
            <span className="break-all">{hash}</span>
            <CopyButton value={hash} label="Copy hash" />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void q.refetch()} loading={q.isFetching} loadingText="Checking">
            <RefreshCw className="size-4" aria-hidden /> Recheck
          </Button>
          {!isTestMode ? (
            <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:border-border-strong">
              Explorer <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      {q.isLoading ? (
        <Card className="flex items-center gap-3 p-6 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Reading the transaction and receipt from {appNetwork.name}…
        </Card>
      ) : q.error ? (
        <Callout tone="danger" role="alert" icon={<CircleAlert />} title="Could not read chain data">
          {(q.error as Error).message} The receipt is unknown, not failed. Try again shortly.
        </Callout>
      ) : r ? (
        <>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Headline r={r} />
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={r.operation === 'unknown' ? 'warning' : 'accent'}>{opLabel[r.operation]}</Badge>
                {record ? <StatusBadge status={record.status} /> : null}
              </div>
            </div>
            {r.status === 'not-found' ? (
              <p className="mt-3 text-sm text-muted">
                This RPC has no record of the transaction. It may not have propagated yet, may have been dropped or replaced, or may belong to another network. This page checks again every few
                seconds; an unknown transaction is never shown as failed or paid.
              </p>
            ) : null}
            {r.operation === 'unknown' && r.status !== 'not-found' && r.status !== 'pending' ? (
              <p className="mt-3 text-sm text-muted">
                This transaction is not a direct USDC transfer or a call to the LastDollar splitter, so it is not labelled as a LastDollar payment.
              </p>
            ) : null}
            {r.comparison?.feeWithinBudget === false ? (
              <Callout tone="warning" className="mt-3" icon={<CircleAlert />} title="Delivered, but fee budget exceeded">
                The payment may have been delivered, but its actual network fee exceeded the maximum you reviewed. This receipt is not fully verified against the reviewed terms.
              </Callout>
            ) : null}
            {r.operation !== 'splitter-batch' && r.operation !== 'unknown' ? (
              <p className="mt-3 text-xs text-muted">Direct transfers carry no on-chain LastDollar marker. Any wallet can produce one; the receipt below is read the same way regardless.</p>
            ) : null}
          </Card>

          {r.status !== 'not-found' ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card>
                <div className="border-b border-border px-5 py-3">
                  <h2 className="font-semibold">Settlement</h2>
                  <p className="text-xs text-muted">From transfer logs in the receipt{r.mirroredNativeLogs ? `; ${r.mirroredNativeLogs} mirrored native log(s) not double counted` : ''}</p>
                </div>
                {r.delivered.length ? (
                  <ol className="divide-y divide-border">
                    {r.delivered.map((d, i) => (
                      <li key={`${d.recipient}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          {record ? (
                            lineMatch(i) ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Matches the reviewed amount" /> : <CircleAlert className="size-4 shrink-0 text-danger" aria-label="Differs from the reviewed amount" />
                          ) : (
                            <span className="w-4 shrink-0 text-xs text-muted tabular">{i + 1}</span>
                          )}
                          {isTestMode ? (
                            <span className="truncate font-mono text-xs">{shortAddress(d.recipient, 6)}</span>
                          ) : (
                            <a href={addressUrl(d.recipient)} target="_blank" rel="noreferrer" className="truncate font-mono text-xs underline-offset-2 hover:underline">
                              {shortAddress(d.recipient, 6)}
                            </a>
                          )}
                        </span>
                        <span className="text-right">
                          <span className="tabular font-medium">{usd(d.amount18)} USDC</span>
                          {d.amount18 % 1_000_000_000_000n !== 0n ? <span className="block text-xs text-muted tabular">{usdExact(d.amount18)}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-5 py-6 text-sm text-muted">{r.status === 'pending' ? 'Waiting for the receipt.' : 'No USDC was delivered by this transaction.'}</p>
                )}
                <div className="flex justify-between border-t border-border px-5 py-3 text-sm">
                  <span className="text-muted">Total delivered</span>
                  <span className="tabular font-semibold">{usd(r.deliveredTotal18)} USDC</span>
                </div>
                {record ? (
                  <div className={cx('border-t border-border px-5 py-3 text-sm', allMatch ? 'text-success' : 'text-muted')}>
                    {allMatch
                      ? 'Every payout matches the amounts reviewed in this browser.'
                      : r.status === 'pending'
                        ? 'Reconciliation completes when the receipt is available.'
                        : 'The receipt does not match the amounts recorded in this browser. Treat this payment as unverified.'}
                  </div>
                ) : null}
              </Card>

              <Card className="p-5">
                <h2 className="font-semibold">Transaction</h2>
                <dl className="mt-3 divide-y divide-border text-sm">
                  {[
                    ['Network', `${appNetwork.name} · chain ${r.chainId}`],
                    ['From', r.from ? <span key="f" className="font-mono text-xs">{shortAddress(r.from, 6)}</span> : '—'],
                    ['To', r.to ? <span key="t" className="font-mono text-xs">{shortAddress(r.to, 6)}</span> : '—'],
                    ['Block', r.blockNumber?.toString() ?? 'Pending'],
                    ['Time', r.blockTimestamp ? formatTime(Number(r.blockTimestamp) * 1000) : '—'],
                    ['Gas used', r.gasUsed ? `${r.gasUsed.toString()} of ${r.submitted?.gas.toString() ?? '—'}` : '—'],
                    ['Effective gas price', gweiString(r.effectiveGasPrice)],
                    ['Actual fee', r.actualFee18 !== undefined ? `${usdExact(r.actualFee18)} USDC` : '—'],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4 py-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="tabular text-right">{v}</dd>
                    </div>
                  ))}
                  {record?.maxFeeBudget18 && r.actualFee18 !== undefined ? (
                    <>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted">Quoted estimate</dt>
                        <dd className="tabular">{usd(record.estimatedFee18)} USDC</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted">Quoted maximum</dt>
                        <dd className="tabular">
                          {usd(record.maxFeeBudget18)} USDC{' '}
                          {r.actualFee18 <= BigInt(record.maxFeeBudget18) ? <span className="text-success">(within)</span> : <span className="text-danger">(exceeded)</span>}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </Card>
            </div>
          ) : null}

          {record ? (
            <Callout tone="neutral" icon={<Info />} title="Saved in this browser">
              Recorded {formatTime(record.createdAt)} as a {record.kind} {record.mode === 'native' ? 'native' : 'ERC-20'} payment. Local notes are reference metadata only; the settlement above comes from chain data.
              {record.note ? <span className="mt-1 block">{record.note}</span> : null}
            </Callout>
          ) : null}
          {r.issues.length && r.status !== 'pending' ? (
            <Callout tone="warning" icon={<CircleDashed />} title="Reconciliation notes">
              <ul className="list-disc pl-4">
                {r.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
