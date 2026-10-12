import { hexToBigInt, type Block, type PublicClient } from 'viem'
import type { ArcNetworkConfig } from './config.js'
import { classifyError } from './errors.js'
import { applyGasMargin, feeBudget18 } from './math.js'

/**
 * Fee policy. Defaults are calibrated against Arc mainnet observations recorded in
 * docs/network-verification.md: a smoothed (EWMA) base fee with a 20 gwei floor, sub-second
 * blocks, and deterministic gas for direct transfers.
 */
export interface FeePolicy {
  /** Gas limit margin over the estimate, in basis points. Default 1000 (10%). */
  gasMarginBps: bigint
  /** Fixed gas added after the percentage margin. Default 2000. */
  gasMarginFixed: bigint
  /**
   * maxFeePerGas headroom over the expected next base fee, in basis points. Default 12500 (1.25x).
   * Arc smooths its base fee, so a modest headroom keeps a quote valid across several blocks.
   */
  baseFeeHeadroomBps: bigint
  /** Lower bound for the priority fee. Default 0 (Arc accepts 0; the RPC suggestion is used if higher). */
  minPriorityFeePerGas: bigint
  /** Upper bound for the priority fee to stop an RPC suggestion inflating the budget. Default 2 gwei. */
  maxPriorityFeePerGas: bigint
}

export const defaultFeePolicy: FeePolicy = {
  gasMarginBps: 1_000n,
  gasMarginFixed: 2_000n,
  baseFeeHeadroomBps: 12_500n,
  minPriorityFeePerGas: 0n,
  maxPriorityFeePerGas: 2_000_000_000n,
}

export interface FeeContext {
  blockNumber: bigint
  /** Base fee of the snapshot block. */
  baseFeePerGas: bigint
  /** Next block's base fee: Arc publishes it in the parent header's extraData when available. */
  nextBaseFeePerGas: bigint
  /** Where nextBaseFeePerGas came from. */
  nextBaseFeeSource: 'extraData' | 'baseFeePerGas'
  maxPriorityFeePerGas: bigint
  maxFeePerGas: bigint
}

/** Arc encodes the next base fee as an 8-byte big-endian integer in extraData. */
export function parseNextBaseFee(extraData: string | undefined): bigint | undefined {
  if (!extraData || !/^0x[0-9a-fA-F]{16}$/.test(extraData)) return undefined
  const v = hexToBigInt(extraData as `0x${string}`)
  return v > 0n ? v : undefined
}

export function computeMaxFeePerGas(
  nextBaseFee: bigint,
  priorityFee: bigint,
  config: Pick<ArcNetworkConfig, 'minBaseFeePerGas'>,
  policy: FeePolicy = defaultFeePolicy,
): bigint {
  const base = nextBaseFee > config.minBaseFeePerGas ? nextBaseFee : config.minBaseFeePerGas
  return (base * policy.baseFeeHeadroomBps + 9_999n) / 10_000n + priorityFee
}

export function clampPriorityFee(suggested: bigint, policy: FeePolicy = defaultFeePolicy): bigint {
  if (suggested < policy.minPriorityFeePerGas) return policy.minPriorityFeePerGas
  if (suggested > policy.maxPriorityFeePerGas) return policy.maxPriorityFeePerGas
  return suggested
}

export function feeContextFromBlock(
  block: Pick<Block, 'number' | 'baseFeePerGas' | 'extraData'>,
  suggestedPriorityFee: bigint,
  config: ArcNetworkConfig,
  policy: FeePolicy = defaultFeePolicy,
): FeeContext {
  const baseFeePerGas = block.baseFeePerGas ?? config.minBaseFeePerGas
  const parsed = parseNextBaseFee(block.extraData)
  const nextBaseFeePerGas = parsed ?? baseFeePerGas
  const priority = clampPriorityFee(suggestedPriorityFee, policy)
  return {
    blockNumber: block.number ?? 0n,
    baseFeePerGas,
    nextBaseFeePerGas,
    nextBaseFeeSource: parsed === undefined ? 'baseFeePerGas' : 'extraData',
    maxPriorityFeePerGas: priority,
    maxFeePerGas: computeMaxFeePerGas(nextBaseFeePerGas, priority, config, policy),
  }
}

export async function readFeeContext(
  client: PublicClient,
  config: ArcNetworkConfig,
  policy: FeePolicy = defaultFeePolicy,
  blockNumber?: bigint,
): Promise<FeeContext> {
  try {
    const [block, suggested] = await Promise.all([
      blockNumber === undefined ? client.getBlock() : client.getBlock({ blockNumber }),
      client.estimateMaxPriorityFeePerGas().catch(() => 0n),
    ])
    return feeContextFromBlock(block, suggested, config, policy)
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
}

export interface FeeQuote {
  gasEstimate: bigint
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  /** gasEstimate * (nextBaseFee + priority): an expectation, not a promise. */
  estimatedFee18: bigint
  /** gasLimit * maxFeePerGas: the most this transaction can be charged under these parameters. */
  maxFeeBudget18: bigint
  nextBaseFeePerGas: bigint
}

export function buildFeeQuote(gasEstimate: bigint, ctx: FeeContext, policy: FeePolicy = defaultFeePolicy): FeeQuote {
  const gasLimit = applyGasMargin(gasEstimate, policy.gasMarginBps, policy.gasMarginFixed)
  const expectedPrice = ctx.nextBaseFeePerGas + ctx.maxPriorityFeePerGas
  const effective = expectedPrice < ctx.maxFeePerGas ? expectedPrice : ctx.maxFeePerGas
  return {
    gasEstimate,
    gasLimit,
    maxFeePerGas: ctx.maxFeePerGas,
    maxPriorityFeePerGas: ctx.maxPriorityFeePerGas,
    estimatedFee18: gasEstimate * effective,
    maxFeeBudget18: feeBudget18(gasLimit, ctx.maxFeePerGas),
    nextBaseFeePerGas: ctx.nextBaseFeePerGas,
  }
}
