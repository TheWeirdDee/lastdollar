'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { History, Info, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { isHash } from 'viem'
import { HistoryList } from '@/components/history-list'
import { Button, Card, Segmented, cx, inputClass } from '@/components/ui'
import { clearRecords, useRecords, type RecordStatus } from '@/lib/history'
import { appNetwork } from '@/lib/network'
import { useSettledRecheck, useWallet } from '@/lib/use-arc'

type Filter = 'all' | 'pending' | 'verified' | 'problem'
type Kind = 'all' | 'exact' | 'max' | 'batch'

const problem: RecordStatus[] = ['reverted', 'mismatch', 'replaced', 'unresolved']

export function HistoryView() {
  const { address, isConnected } = useWallet()
  const records = useRecords(appNetwork.chainId, address)
  const [filter, setFilter] = useState<Filter>('all')
  const [kind, setKind] = useState<Kind>('all')
  const [lookup, setLookup] = useState('')
  const [lookupError, setLookupError] = useState<string>()
  const [confirmClear, setConfirmClear] = useState(false)
  const router = useRouter()
  useSettledRecheck()

  const shown = useMemo(
    () =>
      records.filter(
        (r) =>
          (kind === 'all' || r.kind === kind) &&
          (filter === 'all' || (filter === 'problem' ? problem.includes(r.status) : r.status === filter)),
      ),
    [records, filter, kind],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">History</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Payments made with this app from this browser, for the connected account. This is not your full wallet history. Statuses are re-read from chain data when this page opens; each row shows when it was last checked.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            const h = lookup.trim()
            if (!isHash(h)) {
              setLookupError('Enter a full transaction hash: 0x followed by 64 hexadecimal characters.')
              return
            }
            setLookupError(undefined)
            router.push(`/app/transactions/${h}`)
          }}
        >
          <label htmlFor="lookup" className="sr-only">
            Look up any transaction hash
          </label>
          <input
            id="lookup"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Look up any transaction hash (0x…)"
            className={cx(inputClass, 'font-mono text-sm')}
            aria-invalid={!!lookupError}
            aria-describedby={lookupError ? 'lookup-error' : undefined}
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" className="h-11">
            <Search className="size-4" aria-hidden /> Look up
          </Button>
        </form>
        {lookupError ? (
          <p id="lookup-error" className="mt-2 text-sm text-danger">
            {lookupError}
          </p>
        ) : null}
      </Card>

      {!isConnected ? (
        <Card className="px-6 py-12 text-center">
          <History className="mx-auto size-6 text-muted" aria-hidden />
          <p className="mt-3 font-medium">Connect a wallet to see its app-tracked payments</p>
          <p className="mt-1 text-sm text-muted">You can still look up any transaction hash above.</p>
        </Card>
      ) : (
        <Card>
          <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 sm:p-5">
            <Segmented
              label="Status"
              name="status-filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'verified', label: 'Verified' },
                { value: 'problem', label: 'Issues' },
              ]}
            />
            <Segmented
              label="Type"
              name="kind-filter"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'All' },
                { value: 'exact', label: 'Exact' },
                { value: 'max', label: 'Max' },
                { value: 'batch', label: 'Batch' },
              ]}
            />
          </div>
          {shown.length ? (
            <HistoryList records={shown} />
          ) : (
            <div className="px-6 py-12 text-center">
              <History className="mx-auto size-6 text-muted" aria-hidden />
              <p className="mt-3 font-medium">{records.length ? 'Nothing matches these filters' : 'No app-tracked payments for this account'}</p>
              <p className="mt-1 text-sm text-muted">{records.length ? 'Try a different status or type.' : 'Payments you send from this browser appear here.'}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-border p-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Stored in this browser only: hashes, amounts and recipients. Clearing it does not affect anything on chain.
            </p>
            <Dialog.Root open={confirmClear} onOpenChange={setConfirmClear}>
              <Dialog.Trigger asChild>
                <Button size="sm" variant="ghost" disabled={!records.length}>
                  Clear local history
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-soft">
                  <Dialog.Title className="font-semibold">Clear local history?</Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm text-muted">
                    This removes {records.length} record{records.length === 1 ? '' : 's'} for this account from this browser. Transactions stay on chain and can still be looked up by hash.
                    {records.some((r) => r.status === 'pending') ? ' Some payments are still pending; you will lose automatic tracking for them.' : ''}
                  </Dialog.Description>
                  <div className="mt-5 flex justify-end gap-2">
                    <Dialog.Close asChild>
                      <Button variant="ghost">Cancel</Button>
                    </Dialog.Close>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (address) clearRecords(appNetwork.chainId, address)
                        setConfirmClear(false)
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </Card>
      )}
    </div>
  )
}
