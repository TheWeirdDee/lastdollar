'use client'

import { readArcBalance, verifyPaymentReceipt, type ReconciledPayment } from '@lastdollar/arc'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
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
export function statusFromReceipt(
  record: Pick<TxRecord, 'recipients' | 'kind' | 'mode' | 'maxFeeBudget18'> & Partial<Pick<TxRecord, 'reviewed'>>,
  r: ReconciledPayment,
): Partial<TxRecord> {
  if (r.status === 'pending' || r.status === 'not-found') return { lastCheckedAt: Date.now(), lastCheck: r.status }
  const base = {
    lastCheckedAt: Date.now(),
    lastCheck: 'confirmed' as const,
    actualFee18: r.actualFee18?.toString(),
    blockNumber: r.blockNumber?.toString(),
  }
  if (r.status === 'reverted') return { ...base, status: 'reverted' }
  const expected = record.recipients
  const matches =
    r.delivered.length === expected.length &&
    expected.every((e, i) => r.delivered[i]?.recipient.toLowerCase() === e.recipient.toLowerCase() && r.delivered[i]?.amount18.toString() === e.amount18)
  const expectedOp = record.kind === 'batch' ? 'splitter-batch' : record.mode === 'native' ? 'native-transfer' : 'erc20-transfer'
  // Compare against the reviewed fee ceiling: the pre-signing snapshot when present, else the quoted budget.
  const reviewedBudget = record.reviewed
    ? BigInt(record.reviewed.request.gas) * BigInt(record.reviewed.request.maxFeePerGas)
    : record.maxFeeBudget18 !== undefined
      ? BigInt(record.maxFeeBudget18)
      : undefined
  const over = reviewedBudget !== undefined && r.actualFee18 !== undefined && r.actualFee18 > reviewedBudget ? r.actualFee18 - reviewedBudget : 0n
  const clean = matches && r.operation === expectedOp && r.issues.length === 0 && over === 0n
  return { ...base, status: clean ? 'verified' : 'mismatch', feeOverBudget18: over > 0n ? over.toString() : undefined }
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

/**
 * Re-reads every settled record once when History opens, so a displayed status is chain-derived
 * rather than whatever this browser stored earlier. An unreachable RPC leaves the last known
 * status and its check time in place; it never turns into a failure.
 */
export function useSettledRecheck() {
  const { address } = useWallet()
  const publicClient = useArcPublicClient()
  const records = useRecords(appNetwork.chainId, address)
  const settled = records.filter((r) => r.status === 'verified' || r.status === 'mismatch' || r.status === 'reverted')
  const key = settled.map((r) => r.hash).join(',')
  const confirmed = useRef(new Set<string>())

  useEffect(() => {
    if (!address || !publicClient) return
    let stopped = false
    void (async () => {
      for (const rec of settled) {
        if (stopped || confirmed.current.has(rec.hash)) continue
        try {
          const r = await verifyPaymentReceipt({ publicClient, hash: rec.hash, config: appNetwork })
          // A not-found or pending answer cannot corroborate a settled status: keep it, but say so.
          patchRecord(appNetwork.chainId, address, rec.hash, statusFromReceipt(rec, r))
          if (r.status !== 'pending' && r.status !== 'not-found') confirmed.current.add(rec.hash)
        } catch {
          patchRecord(appNetwork.chainId, address, rec.hash, { lastCheckedAt: Date.now(), lastCheck: 'rpc-error' })
        }
      }
    })()
    return () => {
      stopped = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient, key])
}
