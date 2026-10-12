'use client'

import { ArrowRight, History, KeyRound, Layers, Send, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { BalanceCard } from '@/components/balance'
import { HistoryList } from '@/components/history-list'
import { Button, ButtonLink, Card } from '@/components/ui'
import { ConnectDialog } from '@/components/wallet'
import { useRecords } from '@/lib/history'
import { appNetwork } from '@/lib/network'
import { useArcBalance, useWallet } from '@/lib/use-arc'

export function OverviewView() {
  const { address, isConnected, status } = useWallet()
  const balance = useArcBalance(address)
  const records = useRecords(appNetwork.chainId, address)
  const [open, setOpen] = useState(false)

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl py-6 sm:py-12">
        <Card className="p-6 sm:p-10">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <KeyRound className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Connect a wallet to start</h1>
          <p className="mt-2 text-muted">
            LastDollar reads your USDC balance on {appNetwork.name} and prepares payments for your wallet to sign. Connecting does not sign or send anything.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setOpen(true)} loading={status === 'reconnecting'} loadingText="Reconnecting">
              Connect wallet
            </Button>
            <ButtonLink href="/proof" size="lg" variant="secondary">
              Explore without a wallet
            </ButtonLink>
          </div>
          <ul className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              Non-custodial: your wallet approves every payment individually.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              Payments run on {appNetwork.name} (chain {appNetwork.chainId}) and move real USDC.
            </li>
          </ul>
        </Card>
        <ConnectDialog open={open} onOpenChange={setOpen} />
      </div>
    )
  }

  const recent = records.slice(0, 5)
  const pending = records.filter((r) => r.status === 'pending').length
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Overview</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <BalanceCard
          balance={balance.data}
          loading={balance.isLoading}
          error={balance.error ? `The balance could not be read from Arc (${(balance.error as Error).message}).` : undefined}
          onRefresh={() => void balance.refetch()}
          refreshing={balance.isFetching}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/app/send" className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
            <Send className="size-5 text-accent" aria-hidden />
            <p className="mt-4 font-semibold">Send</p>
            <p className="mt-1 text-sm text-muted">Exact amount or send maximum, native or ERC-20.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
              Start <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
          <Link href="/app/batch" className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
            <Layers className="size-5 text-accent" aria-hidden />
            <p className="mt-4 font-semibold">Batch</p>
            <p className="mt-1 text-sm text-muted">Many recipients, one atomic native transaction.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
              Start <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold">Recent payments</h2>
            <p className="text-xs text-muted">Tracked by this app in this browser{pending ? ` · ${pending} pending` : ''}</p>
          </div>
          <Link href="/app/history" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            All <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {recent.length ? (
          <HistoryList records={recent} />
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <History className="size-6 text-muted" aria-hidden />
            <p className="mt-3 font-medium">No payments from this app yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Payments you make here appear with their verified status. Earlier wallet activity is not shown.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
