'use client'

import { BATCH_CSV_TEMPLATE, SPLITTER_MAX_RECIPIENTS, isLastDollarError, parseBatchCsv, parseUsdc, quoteBatchPayment, type CsvRow } from '@lastdollar/arc'
import { AlertTriangle, Download, FileUp, Info, Layers, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useId, useMemo, useRef, useState } from 'react'
import { getAddress, isAddress, zeroAddress } from 'viem'
import { FlowPanel } from '@/components/flow-panel'
import { SplitColumns } from '@/components/split-columns'
import { Badge, Button, Callout, Card, cx, inputClass } from '@/components/ui'
import { ConnectDialog } from '@/components/wallet'
import { addressUrl, shortAddress, usd } from '@/lib/format'
import { appNetwork, isTestMode } from '@/lib/network'
import { useArcBalance, useArcPublicClient, useWallet } from '@/lib/use-arc'
import { usePaymentFlow } from '@/lib/use-payment-flow'

interface Row {
  id: number
  recipient: string
  amount: string
  reference: string
}

let nextId = 1
const blank = (): Row => ({ id: nextId++, recipient: '', amount: '', reference: '' })

function checkRow(r: Row): { recipient?: string; amount?: string; amount18?: bigint; address?: `0x${string}` } {
  const out: { recipient?: string; amount?: string; amount18?: bigint; address?: `0x${string}` } = {}
  const a = r.recipient.trim()
  if (!a) out.recipient = 'Required'
  else if (!isAddress(a, { strict: false })) out.recipient = 'Invalid address'
  else if (getAddress(a) === zeroAddress) out.recipient = 'Zero address not allowed'
  else out.address = getAddress(a)
  try {
    const v = parseUsdc(r.amount)
    if (v <= 0n) out.amount = 'Must be more than zero'
    else out.amount18 = v
  } catch (err) {
    out.amount = r.amount.trim() === '' ? 'Required' : isLastDollarError(err, 'INVALID_PRECISION') ? 'Max 6 decimals' : 'Invalid amount'
  }
  return out
}

export function BatchView() {
  const { address, isConnected, onAppChain } = useWallet()
  const balance = useArcBalance(address)
  const publicClient = useArcPublicClient()
  const flow = usePaymentFlow()
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank()])
  const [touched, setTouched] = useState(false)
  const [ackDuplicates, setAckDuplicates] = useState(false)
  const [csvReport, setCsvReport] = useState<{ fileName: string; errors: string[]; rows: CsvRow[] } | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const splitterReady = !!appNetwork.splitter
  const locked = flow.state.step === 'review' || flow.state.step === 'executing' || flow.state.step === 'changed' || flow.state.step === 'quoting'

  const checks = useMemo(() => rows.map(checkRow), [rows])
  const duplicates = useMemo(() => {
    const seen = new Map<string, number[]>()
    checks.forEach((c, i) => {
      if (!c.address) return
      seen.set(c.address, [...(seen.get(c.address) ?? []), i])
    })
    return [...seen.entries()].filter(([, idx]) => idx.length > 1)
  }, [checks])
  const dupRows = new Set(duplicates.flatMap(([, idx]) => idx))
  const total18 = checks.reduce((s, c) => s + (c.amount18 ?? 0n), 0n)
  const invalidCount = checks.filter((c) => c.recipient || c.amount).length
  const tooMany = rows.length > SPLITTER_MAX_RECIPIENTS

  function update(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setAckDuplicates(false)
  }

  async function importCsv(file: File) {
    const text = await file.text()
    const parsed = parseBatchCsv(text)
    setCsvReport({ fileName: file.name, errors: parsed.errors, rows: parsed.rows.filter((r) => r.errors.length > 0) })
    if (parsed.errors.length === 0 && parsed.rows.length > 0) {
      // Rows are loaded exactly as written, including invalid ones, so they can be fixed in place.
      setRows(parsed.rows.map((r) => ({ id: nextId++, recipient: r.recipient, amount: r.amount, reference: r.reference })))
      setTouched(true)
      setAckDuplicates(false)
    }
  }

  function runQuote() {
    setTouched(true)
    if (!address || invalidCount > 0 || tooMany || (duplicates.length > 0 && !ackDuplicates)) return
    const payments = checks.map((c, i) => ({ recipient: c.address!, amount18: c.amount18!, reference: rows[i]!.reference || undefined }))
    void flow.quote(() => quoteBatchPayment({ publicClient, account: address, payments, config: appNetwork }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Batch payment</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pay up to {SPLITTER_MAX_RECIPIENTS} recipients in one native-USDC transaction. Either everyone is paid exactly, or the transaction reverts and nobody is.
          </p>
        </div>
        {isConnected && balance.data ? (
          <p className="text-sm text-muted">
            Balance <span className="tabular font-medium text-text">{usd(balance.data.native18)} USDC</span>
          </p>
        ) : null}
      </div>

      {!splitterReady ? (
        <Callout tone="warning" icon={<AlertTriangle />} title="Batch contract not deployed on this network yet">
          Batch payments need the LastDollarSplitter contract. Until its mainnet deployment is recorded in the{' '}
          <Link href="/proof" className="underline">
            public evidence
          </Link>
          , you can prepare and validate a batch here, but quoting is disabled.
        </Callout>
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted">
          <Layers className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Splitter contract{' '}
            {isTestMode ? (
              <span className="font-mono">{shortAddress(appNetwork.splitter, 6)}</span>
            ) : (
              <a href={addressUrl(appNetwork.splitter!)} className="font-mono underline" target="_blank" rel="noreferrer">
                {shortAddress(appNetwork.splitter, 6)}
              </a>
            )}
            . No owner, no fees, holds nothing between transactions. A reverted batch still costs gas.
          </span>
        </p>
      )}

      {flow.state.step === 'idle' && flow.state.notice ? (
        <Callout tone="warning" role="status" icon={<AlertTriangle />}>
          {flow.state.notice}
        </Callout>
      ) : null}

      <SplitColumns
        breakpoint="xl"
        className="xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        left={
        <Card className="overflow-hidden">
          <fieldset disabled={locked}>
            <legend className="sr-only">Recipients</legend>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">
                Recipients <span className="text-muted">({rows.length})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  id={fileId}
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="Import recipients from a CSV file"
                  tabIndex={-1}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void importCsv(f)
                    e.target.value = ''
                  }}
                />
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <FileUp className="size-4" aria-hidden /> Import CSV
                </Button>
                <a
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-accent hover:bg-surface-2"
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(BATCH_CSV_TEMPLATE)}`}
                  download="lastdollar-batch-template.csv"
                >
                  <Download className="size-4" aria-hidden /> Template
                </a>
              </div>
            </div>

            {csvReport && (csvReport.errors.length > 0 || csvReport.rows.length > 0) ? (
              <div className="border-b border-border p-4 sm:px-5">
                <Callout tone="danger" role="alert" title={`${csvReport.fileName} has problems`}>
                  {csvReport.errors.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {csvReport.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      <p>The rows were loaded as written. Fix the highlighted rows below; nothing was rounded, merged or removed.</p>
                      <ul className="mt-1 list-disc pl-4">
                        {csvReport.rows.slice(0, 8).map((r) => (
                          <li key={r.line}>
                            Line {r.line}: {r.errors.join(' ')}
                          </li>
                        ))}
                        {csvReport.rows.length > 8 ? <li>…and {csvReport.rows.length - 8} more</li> : null}
                      </ul>
                    </>
                  )}
                </Callout>
              </div>
            ) : null}

            <div className="hidden grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-3 bg-surface-2 px-5 py-2 text-xs font-medium text-muted md:grid">
              <span>#</span>
              <span>Recipient address</span>
              <span>Amount (USDC)</span>
              <span>Reference (optional)</span>
              <span className="sr-only">Remove</span>
            </div>
            <ol className="divide-y divide-border">
              {rows.map((r, i) => {
                const c = checks[i]!
                const showErr = touched || r.recipient !== '' || r.amount !== ''
                return (
                  <li key={r.id} className={cx('px-4 py-3 sm:px-5', dupRows.has(i) && 'bg-warning-soft/60')}>
                    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] gap-x-3 gap-y-2 md:grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] md:items-start">
                      <span className="pt-2.5 text-xs text-muted tabular">{i + 1}</span>
                      <div className="col-start-2 md:col-start-auto">
                        <label className="sr-only" htmlFor={`r-${r.id}`}>
                          Recipient {i + 1} address
                        </label>
                        <input
                          id={`r-${r.id}`}
                          value={r.recipient}
                          onChange={(e) => update(r.id, { recipient: e.target.value })}
                          placeholder="0x…"
                          spellCheck={false}
                          autoComplete="off"
                          className={cx(inputClass, 'h-10 font-mono text-xs')}
                          aria-invalid={showErr && !!c.recipient}
                          aria-describedby={showErr && c.recipient ? `r-${r.id}-err` : undefined}
                        />
                        {showErr && c.recipient ? (
                          <p id={`r-${r.id}-err`} className="mt-1 text-xs text-danger">
                            {c.recipient}
                          </p>
                        ) : dupRows.has(i) ? (
                          <p className="mt-1 text-xs text-warning">Repeated recipient</p>
                        ) : null}
                      </div>
                      <div className="col-start-2 md:col-start-auto">
                        <label className="sr-only" htmlFor={`a-${r.id}`}>
                          Recipient {i + 1} amount in USDC
                        </label>
                        <input
                          id={`a-${r.id}`}
                          value={r.amount}
                          onChange={(e) => update(r.id, { amount: e.target.value })}
                          placeholder="Amount"
                          inputMode="decimal"
                          autoComplete="off"
                          className={cx(inputClass, 'h-10 tabular text-sm')}
                          aria-invalid={showErr && !!c.amount}
                          aria-describedby={showErr && c.amount ? `a-${r.id}-err` : undefined}
                        />
                        {showErr && c.amount ? (
                          <p id={`a-${r.id}-err`} className="mt-1 text-xs text-danger">
                            {c.amount}
                          </p>
                        ) : null}
                      </div>
                      <div className="col-start-2 md:col-start-auto">
                        <label className="sr-only" htmlFor={`f-${r.id}`}>
                          Recipient {i + 1} reference
                        </label>
                        <input
                          id={`f-${r.id}`}
                          value={r.reference}
                          maxLength={64}
                          onChange={(e) => update(r.id, { reference: e.target.value })}
                          placeholder="Reference"
                          autoComplete="off"
                          className={cx(inputClass, 'h-10 text-sm')}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [blank()]))}
                        className="col-start-3 row-start-1 inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger md:col-start-auto md:row-start-auto"
                        aria-label={`Remove recipient ${i + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
              <Button size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])} disabled={rows.length >= SPLITTER_MAX_RECIPIENTS}>
                <Plus className="size-4" aria-hidden /> Add recipient
              </Button>
              <p className="text-sm">
                Total <span className="tabular font-semibold">{usd(total18)} USDC</span>
                {touched && invalidCount > 0 ? <Badge tone="danger" className="ml-2">{invalidCount} to fix</Badge> : null}
              </p>
            </div>

            <div className="space-y-4 border-t border-border p-4 sm:p-5">
              {tooMany ? (
                <Callout tone="danger" role="alert">
                  At most {SPLITTER_MAX_RECIPIENTS} recipients per batch.
                </Callout>
              ) : null}
              {duplicates.length > 0 ? (
                <Callout tone="warning" icon={<AlertTriangle />} title={`${duplicates.length} address${duplicates.length > 1 ? 'es appear' : ' appears'} more than once`}>
                  <ul className="list-disc pl-4 text-xs">
                    {duplicates.map(([addr, idx]) => (
                      <li key={addr}>
                        <span className="font-mono">{shortAddress(addr, 6)}</span> in rows {idx.map((x) => x + 1).join(', ')}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-2 flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={ackDuplicates} onChange={(e) => setAckDuplicates(e.target.checked)} />
                    <span>Pay each row separately. Rows are never merged.</span>
                  </label>
                </Callout>
              ) : null}
              <p className="flex gap-2 text-xs text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                CSV format: <span className="font-mono">recipient,amount,reference</span>. Amounts in USDC with up to 6 decimals.
              </p>
              {!isConnected ? (
                <Button className="w-full" size="lg" onClick={() => setConnectOpen(true)}>
                  Connect wallet to quote
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={runQuote}
                  disabled={!splitterReady || !onAppChain || tooMany || (touched && invalidCount > 0) || (duplicates.length > 0 && !ackDuplicates)}
                  loading={flow.state.step === 'quoting'}
                  loadingText="Quoting"
                >
                  {!onAppChain ? `Switch to ${appNetwork.name} to quote` : !splitterReady ? 'Batch contract unavailable' : 'Quote batch'}
                </Button>
              )}
            </div>
          </fieldset>
        </Card>
        }

        right={
          <>
          {flow.state.step === 'idle' ? (
            <Card className="p-6 text-sm text-muted">
              <p className="font-medium text-text">Your batch quote appears here</p>
              <p className="mt-1">
                The quote uses the real batch calldata. You will review every recipient and amount, then sign one transaction. No token approval is needed because the batch moves native USDC.
              </p>
            </Card>
          ) : (
            <FlowPanel flow={flow} onRefreshQuote={runQuote} editLabel="Edit batch" />
          )}
          </>
        }
      />
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}
