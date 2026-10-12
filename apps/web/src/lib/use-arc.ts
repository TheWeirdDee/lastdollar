'use client'

import { readArcBalance, verifyPaymentReceipt, type ReconciledPayment } from '@lastdollar/arc'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { PublicClient } from 'viem'
import { useConnection, usePublicClient } from 'wagmi'
import { patchRecord, useRecords, type TxRecord } from './history'
import { appNetwork } from './network'

/** Wallet connection state relative to the app's single network. */
export function useWallet() {
  const c = useConnection()
  const address = c.address
  const walletChainId = c.chainId
  return {
    address,
    isConnected: c.status === 'connected' && !!address,
    status: c.status,
    connector: c.connector,
    walletChainId,
    onAppChain: walletChainId === appNetwork.chainId,
  }
}

export function useArcPublicClient(): PublicClient {
  return usePublicClient({ chainId: appNetwork.chainId }) as PublicClient
}

export function useArcBalance(address: `0x${string}` | undefined) {
  const publicClient = useArcPublicClient()
  return useQuery({
    queryKey: ['arc-balance', appNetwork.chainId, address],
    enabled: !!address && !!publicClient,
    queryFn: () => readArcBalance({ publicClient, address: address!, config: appNetwork }),
    refetchInterval: 15_000,
    staleTime: 0,
  })
}

/** Derives a history status from chain data and the locally recorded intent. */
export function statusFromReceipt(record: TxRecord, r: ReconciledPayment): Partial<TxRecord> {
  if (r.status === 'pending' || r.status === 'not-found') return { lastCheckedAt: Date.now() }
  const base = {
    lastCheckedAt: Date.now(),
    actualFee18: r.actualFee18?.toString(),
    blockNumber: r.blockNumber?.toString(),
  }
  if (r.status === 'reverted') return { ...base, status: 'reverted' }
  const expected = record.recipients
  const matches =
    r.delivered.length === expected.length &&
    expected.every((e, i) => r.delivered[i]?.recipient.toLowerCase() === e.recipient.toLowerCase() && r.delivered[i]?.amount18.toString() === e.amount18)
  const expectedOp = record.kind === 'batch' ? 'splitter-batch' : record.mode === 'native' ? 'native-transfer' : 'erc20-transfer'
  return { ...base, status: matches && r.operation === expectedOp && r.issues.length === 0 ? 'verified' : 'mismatch' }
}

/**
 * Recovers app-tracked payments after a refresh or in another tab: re-reads every pending
 * record from chain data until it resolves. Never resubmits anything.
 */
export function usePendingWatcher() {
  const { address } = useWallet()
  const publicClient = useArcPublicClient()
  const records = useRecords(appNetwork.chainId, address)
  const pending = records.filter((r) => r.status === 'pending')
  const key = pending.map((p) => p.hash).join(',')

  useEffect(() => {
    if (!address || !publicClient || pending.length === 0) return
    let stopped = false
    const tick = async () => {
      for (const rec of pending) {
        if (stopped) return
        try {
          const r = await verifyPaymentReceipt({ publicClient, hash: rec.hash, config: appNetwork })
          if (r.status === 'not-found') {
            // If the account's nonce has moved past this transaction and it is unknown, it was
            // replaced or dropped. The outcome is unresolved, never assumed.
            const nonce = await publicClient.getTransactionCount({ address })
            if (nonce > rec.nonce && Date.now() - rec.createdAt > 60_000) {
              patchRecord(appNetwork.chainId, address, rec.hash, {
                status: 'unresolved',
                lastCheckedAt: Date.now(),
                note: 'This transaction is no longer known to the network, and another transaction used its nonce. Check your wallet activity before sending again.',
              })
            }
            continue
          }
          patchRecord(appNetwork.chainId, address, rec.hash, statusFromReceipt(rec, r))
        } catch {
          /* RPC hiccup: try again next tick */
        }
      }
    }
    void tick()
    const id = setInterval(tick, 4_000)
    return () => {
      stopped = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient, key])
}
