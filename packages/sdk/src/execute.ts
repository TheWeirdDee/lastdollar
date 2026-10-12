import { defineChain, getAddress, type Chain, type Hash, type PublicClient, type WalletClient } from 'viem'
import { arcMainnet, type ArcNetworkConfig } from './config.js'
import { LastDollarError, classifyError } from './errors.js'
import type { FeePolicy } from './fees.js'
import { revalidatePlan } from './plan.js'
import { verifyPaymentReceipt } from './receipt.js'
import type { ExecutionResult, ExecutionUpdate, PreparedPayment } from './types.js'

/** Builds a viem chain object from a LastDollar network config. */
export function toViemChain(config: ArcNetworkConfig): Chain {
  return defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [...config.rpcUrls] } },
    blockExplorers: { default: { name: `${config.name} Explorer`, url: config.explorerUrl } },
  })
}

export interface ExecutePaymentInput {
  walletClient: WalletClient
  publicClient: PublicClient
  plan: PreparedPayment
  config?: ArcNetworkConfig
  feePolicy?: FeePolicy
  /** Progress callback for UI state. */
  onUpdate?: (update: ExecutionUpdate) => void
  /** Called with the hash as soon as the wallet returns it, before waiting for a receipt. Persist it. */
  onBroadcast?: (hash: Hash) => void
  /** Receipt wait timeout in ms. Default 120 000. On timeout a RECEIPT_TIMEOUT error carries the hash. */
  timeoutMs?: number
  /**
   * Skip the pre-signing revalidation. Only for callers that revalidated themselves within the
   * same tick; the default (false) is strongly recommended.
   */
  skipRevalidation?: boolean
}

/**
 * Executes a reviewed plan through the consumer's wallet:
 * check chain and account, revalidate, request one signature, wait for the receipt, reconcile.
 *
 * Never switches networks and never signs on its own. If revalidation finds changed terms it
 * throws STALE_QUOTE with the fresh quote in `details.fresh` so the caller can show it for review.
 */
export async function executePayment(input: ExecutePaymentInput): Promise<ExecutionResult> {
  const config = input.config ?? arcMainnet
  const { walletClient, publicClient, plan, onUpdate } = input
  const request = plan.request

  const walletAccount = walletClient.account?.address
  if (!walletAccount) throw new LastDollarError('ACCOUNT_MISMATCH', 'The wallet client has no account.')
  if (getAddress(walletAccount) !== getAddress(request.from)) {
    throw new LastDollarError('ACCOUNT_MISMATCH', `The wallet account ${walletAccount} is not the quoted payer ${request.from}.`)
  }
  let walletChain: number
  try {
    walletChain = await walletClient.getChainId()
  } catch (err) {
    throw classifyError(err)
  }
  if (walletChain !== request.chainId || walletChain !== config.chainId) {
    throw new LastDollarError('WRONG_CHAIN', `The wallet is on chain ${walletChain}. Switch it to ${config.name} (${config.chainId}) first.`, {
      details: { actual: walletChain, expected: config.chainId },
    })
  }

  if (!input.skipRevalidation) {
    onUpdate?.({ status: 'revalidating' })
    const check = await revalidatePlan({ publicClient, plan, config, ...(input.feePolicy ? { feePolicy: input.feePolicy } : {}) })
    if (check.status !== 'valid') {
      throw new LastDollarError('STALE_QUOTE', 'Conditions changed since review. Review the updated quote before signing.', {
        details: { fresh: check.fresh, changes: check.changes, status: check.status },
      })
    }
  }

  onUpdate?.({ status: 'awaiting-signature' })
  let hash: Hash
  try {
    hash = await walletClient.sendTransaction({
      account: walletClient.account!,
      chain: toViemChain(config),
      to: request.to,
      data: request.data,
      value: request.value,
      gas: request.gas,
      maxFeePerGas: request.maxFeePerGas,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas,
      nonce: request.nonce,
      type: 'eip1559',
    })
  } catch (err) {
    const e = classifyError(err, 'BROADCAST_FAILED')
    throw e.code === 'SIMULATION_FAILED' ? new LastDollarError('BROADCAST_FAILED', e.message, { cause: err }) : e
  }
  input.onBroadcast?.(hash)
  onUpdate?.({ status: 'submitted', hash })

  let finalHash: Hash = hash
  let replacement: ExecutionResult['replacement']
  try {
    onUpdate?.({ status: 'confirming', hash })
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: input.timeoutMs ?? 120_000,
      onReplaced: (r) => {
        replacement = { reason: r.reason, originalHash: hash }
        finalHash = r.transaction.hash
        onUpdate?.({ status: 'replaced', hash: r.transaction.hash, message: r.reason })
      },
    })
    finalHash = receipt.transactionHash
  } catch (err) {
    const e = classifyError(err, 'RECEIPT_TIMEOUT')
    throw new LastDollarError(e.code === 'UNKNOWN' ? 'RECEIPT_TIMEOUT' : e.code, e.message, { cause: err, hash })
  }

  if (replacement && replacement.reason !== 'repriced') {
    const receipt = await verifyPaymentReceipt({ publicClient, hash: finalHash, config })
    throw new LastDollarError(
      'TRANSACTION_REPLACED',
      replacement.reason === 'cancelled'
        ? 'The wallet cancelled this payment with a replacement transaction.'
        : 'Another transaction replaced this payment. It did not execute as reviewed.',
      { hash, details: { replacementHash: finalHash, receipt } },
    )
  }

  onUpdate?.({ status: 'reconciling', hash: finalHash })
  const receipt = await verifyPaymentReceipt({ publicClient, hash: finalHash, config, expected: plan })
  onUpdate?.({
    status: receipt.status === 'verified' ? 'verified' : receipt.status === 'reverted' ? 'reverted' : 'mismatch',
    hash: finalHash,
  })
  return { hash, finalHash, replacement, receipt }
}
