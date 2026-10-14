'use client'

import {
  classifyError,
  executePayment,
  preparePayment,
  type ExecutionResult,
  type ExecutionStatus,
  type LastDollarError,
  type PaymentQuote,
  type PreparedPayment,
  type QuoteChange,
} from '@lastdollar/arc'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WalletClient } from 'viem'
import { useWalletClient } from 'wagmi'
import { acquireSubmissionLock, getReviewSnapshot, patchRecord, releaseSubmissionLock, saveReviewSnapshot, upsertRecord, type TxRecord } from './history'
import { appNetwork } from './network'
import { statusFromReceipt, useArcPublicClient, useWallet } from './use-arc'

export type FlowState =
  | { step: 'idle'; notice?: string | undefined }
  | { step: 'quoting' }
  | { step: 'quoted'; quote: PaymentQuote }
  | { step: 'review'; plan: PreparedPayment; notice?: string | undefined }
  | { step: 'changed'; plan: PreparedPayment; fresh: PaymentQuote; changes: QuoteChange[] }
  | { step: 'executing'; plan: PreparedPayment; status: ExecutionStatus; hash?: `0x${string}` | undefined }
  | { step: 'done'; plan: PreparedPayment; result: ExecutionResult }
  | { step: 'failed'; plan?: PreparedPayment | undefined; error: LastDollarError; hash?: `0x${string}` | undefined }
  | { step: 'quote-error'; error: LastDollarError }

export function usePaymentFlow() {
  const [state, setState] = useState<FlowState>({ step: 'idle' })
  const { address, walletChainId, onAppChain } = useWallet()
  const publicClient = useArcPublicClient()
  const { data: walletClient } = useWalletClient({ chainId: appNetwork.chainId })
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const quoteGeneration = useRef(0)

  // Any account or chain change invalidates a quote or review that was built for the old state.
  const identity = `${address ?? ''}:${walletChainId ?? ''}`
  const lastIdentity = useRef(identity)
  useEffect(() => {
    if (lastIdentity.current === identity) return
    lastIdentity.current = identity
    quoteGeneration.current += 1
    setState((s) =>
      s.step === 'quoting' || s.step === 'quoted' || s.step === 'review' || s.step === 'changed' || s.step === 'quote-error'
        ? { step: 'idle', notice: 'Your wallet account or network changed, so the previous quote was discarded. Quote again to continue.' }
        : s,
    )
  }, [identity])

  const quote = useCallback(async (fn: () => Promise<PaymentQuote>) => {
    const generation = ++quoteGeneration.current
    const quotedIdentity = identity
    setState({ step: 'quoting' })
    try {
      const q = await fn()
      // Do not let an old request republish terms after an edit, competing
      // request, account/chain change, or navigation away from the flow.
      if (generation !== quoteGeneration.current || quotedIdentity !== `${address ?? ''}:${walletChainId ?? ''}`) return
      setState({ step: 'quoted', quote: q })
    } catch (err) {
      if (generation !== quoteGeneration.current || quotedIdentity !== `${address ?? ''}:${walletChainId ?? ''}`) return
      setState({ step: 'quote-error', error: classifyError(err) })
    }
  }, [address, identity, walletChainId])

  const review = useCallback(() => {
    setState((s) => {
      if (s.step !== 'quoted') return s
      try {
        return { step: 'review', plan: preparePayment(s.quote) }
      } catch (err) {
        return { step: 'quote-error', error: classifyError(err) }
      }
    })
  }, [])

  const acceptChanges = useCallback(() => {
    setState((s) => {
      if (s.step !== 'changed') return s
      if (s.fresh.status !== 'ready') return { step: 'quoted', quote: s.fresh }
      return { step: 'review', plan: preparePayment(s.fresh), notice: 'Updated terms. Review them before signing.' }
    })
  }, [])

  const backToEdit = useCallback(() => {
    quoteGeneration.current += 1
    setState({ step: 'idle' })
  }, [])

  const invalidate = useCallback(() => {
    quoteGeneration.current += 1
    setState((s) => (s.step === 'idle' ? s : { step: 'idle', notice: 'Payment details changed, so the previous quote was discarded. Quote again to continue.' }))
  }, [])

  const sign = useCallback(
    async (plan: PreparedPayment) => {
      if (inFlight.current) return
      if (!address || !walletClient || !onAppChain) {
        setState({ step: 'review', plan, notice: 'Connect your wallet on the right network first.' })
        return
      }
      if (!acquireSubmissionLock(address, plan.quote.id)) {
        setState({
          step: 'review',
          plan,
          notice: 'Another LastDollar tab is already signing a payment for this account. Finish or close it first, then try again.',
        })
        return
      }
      inFlight.current = true
      // Persist this immutable public review before opening the wallet.  The
      // transaction hash is unavailable until broadcast, so the callback below
      // attaches this already-recorded snapshot to the hash rather than making
      // a new post-signing “review”.
      saveReviewSnapshot({
        chainId: plan.quote.chainId, account: plan.quote.account, quoteId: plan.quote.id,
        observedAt: Date.now(), snapshotBlock: plan.quote.balance.blockNumber.toString(),
        request: { to: plan.request.to, data: plan.request.data, value: plan.request.value.toString(), gas: plan.request.gas.toString(), maxFeePerGas: plan.request.maxFeePerGas.toString(), maxPriorityFeePerGas: plan.request.maxPriorityFeePerGas.toString(), nonce: plan.request.nonce },
        maxDebit18: plan.quote.maxDebit18.toString(),
      })
      let broadcastHash: `0x${string}` | undefined
      setState({ step: 'executing', plan, status: 'revalidating' })
      try {
        const result = await executePayment({
          walletClient: walletClient as WalletClient,
          publicClient,
          plan,
          config: appNetwork,
          timeoutMs: 90_000,
          onBroadcast: (hash) => {
            broadcastHash = hash
            const q = plan.quote
            upsertRecord({
              v: 1,
              hash,
              chainId: q.chainId,
              account: q.account,
              kind: q.kind,
              mode: q.mode,
              nonce: plan.request.nonce,
              quoteId: q.id,
              createdAt: Date.now(),
              status: 'pending',
              recipients: q.lines.map((l) => ({ recipient: l.recipient, amount18: l.amount18.toString(), reference: l.reference })),
              total18: q.recipientTotal18.toString(),
              estimatedFee18: q.fee?.estimatedFee18.toString(),
              maxFeeBudget18: q.fee?.maxFeeBudget18.toString(),
              reviewed: getReviewSnapshot(q.chainId, q.account, q.id),
            })
          },
          onUpdate: (u) => setState({ step: 'executing', plan, status: u.status, hash: u.hash ?? broadcastHash }),
        })
        if (result.finalHash !== result.hash && broadcastHash) {
          patchRecord(appNetwork.chainId, address, broadcastHash, { status: 'replaced', replacementHash: result.finalHash })
          const q = plan.quote
          upsertRecord({
            v: 1,
            hash: result.finalHash,
            chainId: q.chainId,
            account: q.account,
            kind: q.kind,
            mode: q.mode,
            nonce: plan.request.nonce,
            quoteId: q.id,
            createdAt: Date.now(),
            status: 'pending',
            recipients: q.lines.map((l) => ({ recipient: l.recipient, amount18: l.amount18.toString(), reference: l.reference })),
            total18: q.recipientTotal18.toString(),
            estimatedFee18: q.fee?.estimatedFee18.toString(),
            maxFeeBudget18: q.fee?.maxFeeBudget18.toString(),
            reviewed: getReviewSnapshot(q.chainId, q.account, q.id),
            note: `Sped up by the wallet; replaces ${broadcastHash}.`,
          })
        }
        const record: Pick<TxRecord, 'recipients' | 'kind' | 'mode' | 'maxFeeBudget18'> = {
          recipients: plan.quote.lines.map((l) => ({ recipient: l.recipient, amount18: l.amount18.toString() })),
          kind: plan.quote.kind,
          mode: plan.quote.mode,
          maxFeeBudget18: (plan.request.gas * plan.request.maxFeePerGas).toString(),
        }
        patchRecord(appNetwork.chainId, address, result.finalHash, statusFromReceipt(record, result.receipt))
        setState({ step: 'done', plan, result })
      } catch (err) {
        const e = classifyError(err)
        if (e.code === 'STALE_QUOTE' && e.details.fresh) {
          setState({ step: 'changed', plan, fresh: e.details.fresh as PaymentQuote, changes: (e.details.changes as QuoteChange[]) ?? [] })
        } else if (e.code === 'USER_REJECTED') {
          setState({ step: 'review', plan, notice: 'You declined the request in your wallet. Nothing was sent.' })
        } else {
          if (broadcastHash && e.code === 'TRANSACTION_REPLACED') {
            patchRecord(appNetwork.chainId, address, broadcastHash, { status: 'replaced', note: e.message })
          }
          setState({ step: 'failed', plan, error: e, hash: e.hash ?? broadcastHash })
        }
      } finally {
        inFlight.current = false
        releaseSubmissionLock(address)
        void queryClient.invalidateQueries({ queryKey: ['arc-balance'] })
      }
    },
    [address, walletClient, onAppChain, publicClient, queryClient],
  )

  return { state, quote, review, sign, acceptChanges, backToEdit, invalidate, reset: backToEdit }
}

export const statusCopy: Record<ExecutionStatus, string> = {
  revalidating: 'Rechecking balance, nonce and fees',
  'awaiting-signature': 'Waiting for your signature in the wallet',
  submitted: 'Submitted to Arc',
  replaced: 'The wallet replaced the transaction; following the replacement',
  confirming: 'Waiting for the receipt',
  reconciling: 'Reconciling transfer logs',
  verified: 'Verified from the receipt',
  mismatch: 'Receipt does not match the reviewed payment',
  reverted: 'The transaction reverted',
}
