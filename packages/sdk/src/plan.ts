import type { PublicClient } from 'viem'
import { arcMainnet, type ArcNetworkConfig } from './config.js'
import { LastDollarError } from './errors.js'
import type { FeePolicy } from './fees.js'
import { requote } from './quote.js'
import { formatUsdc } from './units.js'
import type { PaymentQuote, PreparedPayment, QuoteChange, RevalidationResult } from './types.js'

/**
 * Freezes a ready quote into the exact request a wallet will sign. Pure: performs no I/O.
 * Throws if the quote is blocked.
 */
export function preparePayment(quote: PaymentQuote): PreparedPayment {
  if (quote.status !== 'ready' || !quote.request) {
    const first = quote.blockers[0]
    throw new LastDollarError(
      (first?.code as LastDollarError['code']) ?? 'SIMULATION_FAILED',
      first?.message ?? 'This quote is not executable.',
      { details: { blockers: quote.blockers } },
    )
  }
  return { quote, request: { ...quote.request }, preparedAt: Date.now() }
}

function diff(before: PaymentQuote, after: PaymentQuote): QuoteChange[] {
  const changes: QuoteChange[] = []
  const push = (field: string, a: string, b: string) => {
    if (a !== b) changes.push({ field, before: a, after: b })
  }
  push('chain', String(before.chainId), String(after.chainId))
  push('account', before.account, after.account)
  push('recipient count', String(before.lines.length), String(after.lines.length))
  before.lines.forEach((l, i) => {
    const n = after.lines[i]
    if (!n) return
    push(`recipient ${i + 1}`, l.recipient, n.recipient)
    push(`amount ${i + 1}`, `${formatUsdc(l.amount18, { maxDecimals: 18 })} USDC`, `${formatUsdc(n.amount18, { maxDecimals: 18 })} USDC`)
  })
  push('maximum fee budget', `${formatUsdc(before.fee?.maxFeeBudget18 ?? 0n, { maxDecimals: 18 })} USDC`, `${formatUsdc(after.fee?.maxFeeBudget18 ?? 0n, { maxDecimals: 18 })} USDC`)
  push('maximum debit', `${formatUsdc(before.maxDebit18, { maxDecimals: 18 })} USDC`, `${formatUsdc(after.maxDebit18, { maxDecimals: 18 })} USDC`)
  push('nonce', String(before.nonce), String(after.nonce))
  push('status', before.status, after.status)
  return changes
}

/**
 * Re-checks a prepared payment against fresh chain state immediately before signing.
 *
 * Returns `valid` only when the economic terms are unchanged: same chain, account, nonce,
 * recipients, amounts, gas limit and fee caps, still affordable, and the final simulation passes.
 * Any change returns `changed` (or `blocked`) together with a fresh quote that must be reviewed.
 */
export async function revalidatePlan(input: {
  publicClient: PublicClient
  plan: PreparedPayment
  config?: ArcNetworkConfig
  feePolicy?: FeePolicy
  ttlMs?: number
}): Promise<RevalidationResult> {
  const { plan } = input
  const config = input.config ?? arcMainnet
  if (plan.quote.chainId !== config.chainId) {
    throw new LastDollarError('WRONG_CHAIN', `This plan was built for chain ${plan.quote.chainId}, not ${config.chainId}.`)
  }
  const fresh = await requote(plan.quote, {
    publicClient: input.publicClient,
    config,
    ...(input.feePolicy ? { feePolicy: input.feePolicy } : {}),
    ...(input.ttlMs ? { ttlMs: input.ttlMs } : {}),
  })
  if (fresh.status !== 'ready' || !fresh.request) {
    return { status: 'blocked', plan, fresh, changes: diff(plan.quote, fresh) }
  }

  const old = plan.request
  const neu = fresh.request
  const sameTerms =
    old.chainId === neu.chainId &&
    old.from === neu.from &&
    old.to === neu.to &&
    old.data === neu.data &&
    old.value === neu.value &&
    old.nonce === neu.nonce
  // The reviewed request may keep its original caps if they still cover current fees.
  const capsStillCover =
    old.maxFeePerGas >= (fresh.fee?.nextBaseFeePerGas ?? 0n) + neu.maxPriorityFeePerGas && old.gas >= (fresh.fee?.gasEstimate ?? 0n)
  const stillAffordable = old.value + old.gas * old.maxFeePerGas <= fresh.balance.native18

  if (sameTerms && capsStillCover && stillAffordable) {
    // Final simulation of the exact reviewed request with its own caps.
    try {
      await input.publicClient.call({
        account: old.from,
        to: old.to,
        data: old.data,
        value: old.value,
        gas: old.gas,
        maxFeePerGas: old.maxFeePerGas,
        maxPriorityFeePerGas: old.maxPriorityFeePerGas,
      })
    } catch {
      return { status: 'changed', plan, fresh, changes: diff(plan.quote, fresh) }
    }
    return { status: 'valid', plan, checkedAtBlock: fresh.balance.blockNumber }
  }
  const changes = diff(plan.quote, fresh)
  if (changes.length === 0) changes.push({ field: 'fee conditions', before: 'reviewed caps', after: 'caps no longer cover current fees' })
  return { status: 'changed', plan, fresh, changes }
}
