import { SCALE } from './config.js'
import { saturatingSub } from './units.js'

/**
 * Pure payment mathematics. Every input and output is an integer in the unit named by its suffix.
 * These functions have no I/O so they can be property-tested and reused anywhere.
 */

/** Upper bound on what a transaction can charge for gas: gasLimit * maxFeePerGas. */
export function feeBudget18(gasLimit: bigint, maxFeePerGas: bigint): bigint {
  if (gasLimit < 0n || maxFeePerGas < 0n) throw new RangeError('gas values must be non-negative')
  return gasLimit * maxFeePerGas
}

/** Applies a percentage margin (in basis points) plus a fixed amount, rounding up. */
export function applyGasMargin(gasEstimate: bigint, marginBps: bigint, fixed: bigint): bigint {
  if (gasEstimate < 0n || marginBps < 0n || fixed < 0n) throw new RangeError('gas values must be non-negative')
  return (gasEstimate * (10_000n + marginBps) + 9_999n) / 10_000n + fixed
}

export interface ExactAffordabilityInput {
  /** Native balance of the payer (18 decimals). */
  balance18: bigint
  /** Value delivered to recipients, expressed in native units (18 decimals). */
  recipientTotal18: bigint
  /** Maximum fee budget for the transaction (18 decimals). */
  feeBudget18: bigint
  /** ERC-20 `balanceOf` (6 decimals), required for ERC-20 mode. */
  tokenBalance6?: bigint | undefined
  /** ERC-20 transfer amount (6 decimals), required for ERC-20 mode. */
  tokenAmount6?: bigint | undefined
}

export interface Affordability {
  affordable: boolean
  /** Payment plus maximum fee budget (18 decimals). */
  maxDebit18: bigint
  /** What is missing when unaffordable (18 decimals), else 0. */
  shortfall18: bigint
  /** True when the payment alone exceeds the balance; otherwise the fee budget is the problem. */
  paymentExceedsBalance: boolean
  /** ERC-20 mode only: true when the token view cannot cover the transfer amount. */
  tokenBalanceTooLow: boolean
}

/**
 * Exact affordability: recipientTotal18 + feeBudget18 <= balance18.
 * In ERC-20 mode this is tokenAmount6 * 10^12 + feeBudget18 <= nativeBalance18, and the transfer
 * amount must also fit inside the token's own `balanceOf`.
 */
export function checkExactAffordability(input: ExactAffordabilityInput): Affordability {
  const { balance18, recipientTotal18, feeBudget18: budget } = input
  if (balance18 < 0n || recipientTotal18 < 0n || budget < 0n) throw new RangeError('amounts must be non-negative')
  const maxDebit18 = recipientTotal18 + budget
  const tokenBalanceTooLow =
    input.tokenAmount6 !== undefined && input.tokenBalance6 !== undefined && input.tokenAmount6 > input.tokenBalance6
  const affordable = maxDebit18 <= balance18 && !tokenBalanceTooLow
  return {
    affordable,
    maxDebit18,
    shortfall18: saturatingSub(maxDebit18, balance18),
    paymentExceedsBalance: recipientTotal18 > balance18,
    tokenBalanceTooLow,
  }
}

/** Native max: max(0, balance18 - feeBudget18). Full 18-decimal precision. */
export function maxNativeAmount18(balance18: bigint, budget18: bigint): bigint {
  if (balance18 < 0n || budget18 < 0n) throw new RangeError('amounts must be non-negative')
  return saturatingSub(balance18, budget18)
}

/** ERC-20 max: min(tokenBalance6, floor(max(0, balance18 - feeBudget18) / 10^12)). */
export function maxTokenAmount6(balance18: bigint, budget18: bigint, tokenBalance6: bigint): bigint {
  if (balance18 < 0n || budget18 < 0n || tokenBalance6 < 0n) throw new RangeError('amounts must be non-negative')
  const fromNative = saturatingSub(balance18, budget18) / SCALE
  return fromNative < tokenBalance6 ? fromNative : tokenBalance6
}

export interface RemainderProjection {
  /** Balance left if the fee equals the estimate (18 decimals). Never negative. */
  estimatedRemaining18: bigint
  /** Balance left if the full fee budget is charged (18 decimals). */
  minimumRemaining18: bigint
}

export function projectRemaining(
  balance18: bigint,
  recipientTotal18: bigint,
  estimatedFee18: bigint,
  budget18: bigint,
): RemainderProjection {
  return {
    estimatedRemaining18: saturatingSub(balance18, recipientTotal18 + estimatedFee18),
    minimumRemaining18: saturatingSub(balance18, recipientTotal18 + budget18),
  }
}

/** Sums a list of non-negative amounts, rejecting negatives. */
export function sumAmounts(amounts: readonly bigint[]): bigint {
  let total = 0n
  for (const a of amounts) {
    if (a < 0n) throw new RangeError('amounts must be non-negative')
    total += a
  }
  return total
}
