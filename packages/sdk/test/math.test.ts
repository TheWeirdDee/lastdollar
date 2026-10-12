import { describe, expect, it } from 'vitest'
import {
  applyGasMargin,
  checkExactAffordability,
  feeBudget18,
  maxNativeAmount18,
  maxTokenAmount6,
  projectRemaining,
  sumAmounts,
} from '../src/math.js'
import { SCALE } from '../src/config.js'
import { buildFeeQuote, computeMaxFeePerGas, defaultFeePolicy, feeContextFromBlock, parseNextBaseFee } from '../src/fees.js'
import { arcMainnet } from '../src/config.js'

const USDC = 10n ** 18n

function rand(bits: number): bigint {
  let v = 0n
  for (let i = 0; i < bits; i += 30) v = (v << 30n) | BigInt(Math.floor(Math.random() * 2 ** 30))
  return v & ((1n << BigInt(bits)) - 1n)
}

describe('exact affordability', () => {
  it('is affordable exactly at the boundary and not one unit past it', () => {
    const budget = 1_406_000_000_000_000n
    const amount = 5n * USDC
    expect(checkExactAffordability({ balance18: amount + budget, recipientTotal18: amount, feeBudget18: budget }).affordable).toBe(true)
    const short = checkExactAffordability({ balance18: amount + budget - 1n, recipientTotal18: amount, feeBudget18: budget })
    expect(short.affordable).toBe(false)
    expect(short.shortfall18).toBe(1n)
    expect(short.paymentExceedsBalance).toBe(false) // the fee budget is what is missing
  })

  it('compares ERC-20 amounts in native units, not raw integers', () => {
    // 1 USDC token-view amount (1e6) vs a 0.0014 USDC fee (1.4e15 wei): naive comparison would be wrong.
    const r = checkExactAffordability({
      balance18: USDC,
      recipientTotal18: 1_000_000n * SCALE,
      feeBudget18: 1_400_000_000_000_000n,
      tokenAmount6: 1_000_000n,
      tokenBalance6: 1_000_000n,
    })
    expect(r.affordable).toBe(false)
    expect(r.shortfall18).toBe(1_400_000_000_000_000n)
  })

  it('flags a token view that cannot cover the transfer', () => {
    const r = checkExactAffordability({
      balance18: 10n * USDC,
      recipientTotal18: 2n * USDC,
      feeBudget18: 0n,
      tokenAmount6: 2_000_000n,
      tokenBalance6: 1_999_999n,
    })
    expect(r.affordable).toBe(false)
    expect(r.tokenBalanceTooLow).toBe(true)
  })
})

describe('send max', () => {
  it('native max is balance minus budget and never underflows', () => {
    expect(maxNativeAmount18(10n, 3n)).toBe(7n)
    expect(maxNativeAmount18(3n, 10n)).toBe(0n)
    expect(maxNativeAmount18(0n, 0n)).toBe(0n)
  })

  it('erc20 max truncates to 6 decimals and respects the token balance', () => {
    const balance = 1_635_832_916_707_859_154n // observed mainnet balance with sub-micro dust
    const budget = 1_406_000_000_000_000n
    expect(maxTokenAmount6(balance, budget, 1_635_832n)).toBe(1_634_426n)
    expect(maxTokenAmount6(balance, 0n, 1_000n)).toBe(1_000n)
    expect(maxTokenAmount6(budget - 1n, budget, 10n)).toBe(0n)
  })

  it('property: the max is affordable and one more unit is not', () => {
    for (let i = 0; i < 3000; i++) {
      const balance = rand(90)
      const budget = rand(60)
      const token = balance / SCALE
      const m = maxTokenAmount6(balance, budget, token)
      expect(m * SCALE + budget <= balance || m === 0n).toBe(true)
      if (m < token) expect((m + 1n) * SCALE + budget > balance).toBe(true)
      const n = maxNativeAmount18(balance, budget)
      if (n > 0n) {
        expect(n + budget).toBe(balance)
      }
    }
  })
})

describe('fee policy', () => {
  it('parses the next base fee from Arc extraData', () => {
    expect(parseNextBaseFee('0x00000004a817c800')).toBe(20_000_000_000n) // observed on mainnet
    expect(parseNextBaseFee('0x')).toBeUndefined()
    expect(parseNextBaseFee('0x1234')).toBeUndefined()
  })

  it('applies the 20 gwei floor and headroom', () => {
    expect(computeMaxFeePerGas(1n, 0n, arcMainnet)).toBe(25_000_000_000n)
    expect(computeMaxFeePerGas(40_000_000_000n, 1_000n, arcMainnet)).toBe(50_000_001_000n)
  })

  it('rounds the gas margin up', () => {
    expect(applyGasMargin(21_000n, 1_000n, 2_000n)).toBe(25_100n)
    expect(applyGasMargin(1n, 1_000n, 0n)).toBe(2n)
  })

  it('keeps the estimate and the budget separate', () => {
    const ctx = feeContextFromBlock(
      { number: 1n, baseFeePerGas: 20_000_000_000n, extraData: '0x00000004a817c800' },
      1151n,
      arcMainnet,
    )
    const q = buildFeeQuote(49_326n, ctx, defaultFeePolicy)
    expect(q.estimatedFee18).toBe(49_326n * (20_000_000_000n + 1151n))
    expect(q.maxFeeBudget18).toBe(q.gasLimit * q.maxFeePerGas)
    expect(q.maxFeeBudget18 > q.estimatedFee18).toBe(true)
    expect(feeBudget18(q.gasLimit, q.maxFeePerGas)).toBe(q.maxFeeBudget18)
  })

  it('clamps an inflated priority fee suggestion', () => {
    const ctx = feeContextFromBlock({ number: 1n, baseFeePerGas: 20_000_000_000n, extraData: '0x' }, 10n ** 12n, arcMainnet)
    expect(ctx.maxPriorityFeePerGas).toBe(defaultFeePolicy.maxPriorityFeePerGas)
    expect(ctx.nextBaseFeeSource).toBe('baseFeePerGas')
  })
})

describe('projections and sums', () => {
  it('projects remaining balance under the estimate and the full budget', () => {
    expect(projectRemaining(100n, 60n, 5n, 20n)).toEqual({ estimatedRemaining18: 35n, minimumRemaining18: 20n })
    expect(projectRemaining(10n, 60n, 5n, 20n)).toEqual({ estimatedRemaining18: 0n, minimumRemaining18: 0n })
  })

  it('rejects negative amounts', () => {
    expect(sumAmounts([1n, 2n, 3n])).toBe(6n)
    expect(() => sumAmounts([1n, -1n])).toThrow()
  })
})
