'use client'

import { isLastDollarError, parseUsdc, quoteExactPayment, quoteMaxPayment, type PaymentMode } from '@lastdollar/arc'
import { AlertTriangle, Info } from 'lucide-react'
import { useRef, useState } from 'react'
import { getAddress, isAddress, zeroAddress } from 'viem'
import { BalanceCard } from '@/components/balance'
import { FlowPanel } from '@/components/flow-panel'
import { Button, Callout, Card, Field, Segmented, cx, inputClass } from '@/components/ui'
import { ConnectDialog } from '@/components/wallet'
import { appNetwork } from '@/lib/network'
import { useArcBalance, useArcPublicClient, useWallet } from '@/lib/use-arc'
import { usePaymentFlow } from '@/lib/use-payment-flow'

type Intent = 'exact' | 'max'

interface Errors {
  recipient?: string | undefined
  amount?: string | undefined
}

export function SendView() {
  const { address, isConnected, onAppChain } = useWallet()
  const balance = useArcBalance(address)
  const publicClient = useArcPublicClient()
  const flow = usePaymentFlow()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [intent, setIntent] = useState<Intent>('exact')
  const [mode, setMode] = useState<PaymentMode>('erc20')
  const [errors, setErrors] = useState<Errors>({})
  const [connectOpen, setConnectOpen] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const locked = flow.state.step === 'review' || flow.state.step === 'executing' || flow.state.step === 'changed' || flow.state.step === 'quoting'

  function validate(): { ok: boolean; recipient?: `0x${string}`; amount18?: bigint } {
    const next: Errors = {}
    let to: `0x${string}` | undefined
    let amount18: bigint | undefined
    const r = recipient.trim()
    if (!r) next.recipient = 'Enter the recipient address.'
    else if (!isAddress(r, { strict: false })) next.recipient = 'That is not a valid address. It should be 0x followed by 40 hexadecimal characters.'
    else if (getAddress(r) === zeroAddress) next.recipient = 'Arc does not allow sending value to the zero address.'
    else to = getAddress(r)
    if (intent === 'exact') {
      try {
        amount18 = parseUsdc(amount)
        if (amount18 <= 0n) next.amount = 'Enter an amount greater than zero.'
      } catch (err) {
        next.amount = isLastDollarError(err) ? err.message : 'Enter a valid amount.'
      }
    }
    setErrors(next)
    const ok = !next.recipient && !next.amount
    if (!ok) setTimeout(() => summaryRef.current?.focus(), 0)
    return { ok, ...(to ? { recipient: to } : {}), ...(amount18 !== undefined ? { amount18 } : {}) }
  }

  function runQuote() {
    const v = validate()
    if (!v.ok || !address || !v.recipient) return
    const to = v.recipient
    const amount18 = v.amount18
    void flow.quote(() =>
      intent === 'max'
        ? quoteMaxPayment({ publicClient, account: address, recipient: to, mode, config: appNetwork })
        : quoteExactPayment({ publicClient, account: address, recipient: to, amount18: amount18!, mode, config: appNetwork }),
    )
  }

  const errorList = Object.entries(errors).filter(([, v]) => v) as [keyof Errors, string][]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Send USDC</h1>
        <p className="mt-1 text-sm text-muted">Quote the full cost, review it, and sign once in your wallet.</p>
      </div>

      {flow.state.step === 'idle' && flow.state.notice ? (
        <Callout tone="warning" role="status" icon={<AlertTriangle />}>
          {flow.state.notice}
        </Callout>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          {isConnected ? (
            <BalanceCard
              balance={balance.data}
              loading={balance.isLoading}
              error={balance.error ? `The balance could not be read from Arc (${(balance.error as Error).message} ${String(((balance.error as Error).cause as { shortMessage?: string; message?: string } | undefined)?.shortMessage ?? ((balance.error as Error).cause as Error | undefined)?.message ?? '')}).` : undefined}
              onRefresh={() => void balance.refetch()}
              refreshing={balance.isFetching}
            />
          ) : null}

          <Card className="p-5 sm:p-6">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                runQuote()
              }}
            >
              <fieldset disabled={locked} className="space-y-5">
                <legend className="sr-only">Payment details</legend>
                {errorList.length > 0 ? (
                  <div ref={summaryRef} tabIndex={-1} className="rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-sm text-danger focus:outline-none" role="alert">
                    <p className="font-medium">Fix {errorList.length === 1 ? 'this' : 'these'} before quoting:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {errorList.map(([field, msg]) => (
                        <li key={field}>
                          <a href={`#${field}`} className="underline">
                            {msg}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Field id="recipient" label="Recipient address" error={errors.recipient} hint="Paste a 0x address. Names are not supported.">
                  <input
                    id="recipient"
                    name="recipient"
                    className={cx(inputClass, 'font-mono text-sm')}
                    placeholder="0x…"
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    aria-invalid={!!errors.recipient}
                    aria-describedby={errors.recipient ? 'recipient-error' : 'recipient-hint'}
                  />
                </Field>

                <Segmented
                  label="Amount"
                  name="intent"
                  value={intent}
                  onChange={(v) => {
                    setIntent(v)
                    setErrors((e) => ({ ...e, amount: undefined }))
                  }}
                  options={[
                    { value: 'exact', label: 'Exact amount' },
                    { value: 'max', label: 'Send maximum' },
                  ]}
                />

                {intent === 'exact' ? (
                  <Field id="amount" label="Amount the recipient receives" error={errors.amount} hint="Up to 6 decimal places. Never rounded.">
                    <div className="relative">
                      <input
                        id="amount"
                        name="amount"
                        inputMode="decimal"
                        className={cx(inputClass, 'pr-16 tabular')}
                        placeholder="0.00"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        aria-invalid={!!errors.amount}
                        aria-describedby={errors.amount ? 'amount-error' : 'amount-hint'}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">USDC</span>
                    </div>
                  </Field>
                ) : (
                  <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    LastDollar reserves a bounded fee budget and sends the rest. A small remainder stays behind: the unused part of the budget
                    {mode === 'erc20' ? ', plus any balance below one micro-USDC' : ''}.
                  </p>
                )}

                <Segmented
                  label="Transfer method"
                  name="mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'erc20', label: 'ERC-20' },
                    { value: 'native', label: 'Native' },
                  ]}
                />
                <p className="-mt-3 text-xs leading-relaxed text-muted">
                  {mode === 'erc20'
                    ? 'Calls the USDC token contract. Recognised by the most apps and explorers. 6-decimal precision.'
                    : 'Sends USDC as native value. Slightly cheaper and exact to 18 decimals. Contract recipients must accept native value.'}
                </p>

                {!isConnected ? (
                  <Button className="w-full" size="lg" onClick={() => setConnectOpen(true)}>
                    Connect wallet to quote
                  </Button>
                ) : !onAppChain ? (
                  <Button className="w-full" size="lg" disabled>
                    Switch to {appNetwork.name} to quote
                  </Button>
                ) : (
                  <Button type="submit" className="w-full" size="lg" loading={flow.state.step === 'quoting'} loadingText="Quoting">
                    {flow.state.step === 'quoted' ? 'Quote again' : 'Get quote'}
                  </Button>
                )}
              </fieldset>
            </form>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          {flow.state.step === 'idle' ? (
            <Card className="p-6 text-sm text-muted">
              <p className="font-medium text-text">Your quote appears here</p>
              <p className="mt-1">You will see what the recipient receives, the estimated fee, the most the transaction can cost, and what remains. Nothing is signed until you review it.</p>
            </Card>
          ) : (
            <FlowPanel flow={flow} onRefreshQuote={runQuote} />
          )}
        </div>
      </div>
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}
