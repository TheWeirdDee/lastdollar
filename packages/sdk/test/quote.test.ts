import { beforeEach, describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { quoteBatchPayment, quoteExactPayment, quoteMaxPayment } from '../src/quote.js'
import { preparePayment, revalidatePlan } from '../src/plan.js'
import { LastDollarError } from '../src/errors.js'
import { SCALE } from '../src/config.js'
import { parseUsdc } from '../src/units.js'
import { createMockClient, createMockState, mockConfig, setBalance, type MockState } from './mockChain.js'

const PAYER = getAddress('0xaaaa00000000000000000000000000000000aaaa')
const BOB = getAddress('0xbbbb00000000000000000000000000000000bbbb')
const CAROL = getAddress('0xcccc00000000000000000000000000000000cccc')
const config = mockConfig()

let state: MockState
beforeEach(() => {
  state = createMockState()
  setBalance(state, PAYER, 1_635_832_916_707_859_154n) // mirrors an observed mainnet balance with dust
})
const client = () => createMockClient(state, config)

describe('quoteExactPayment', () => {
  it('quotes a ready ERC-20 payment with separate estimate and budget', async () => {
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('1'), mode: 'erc20', config })
    expect(q.status).toBe('ready')
    expect(q.simulation).toBe('passed')
    expect(q.tokenAmount6).toBe(1_000_000n)
    expect(q.request?.to).toBe(config.usdc)
    expect(q.request?.value).toBe(0n)
    expect(q.fee!.maxFeeBudget18 > q.fee!.estimatedFee18).toBe(true)
    expect(q.maxDebit18).toBe(parseUsdc('1') + q.fee!.maxFeeBudget18)
    expect(q.minimumRemaining18).toBe(q.balance.native18 - q.maxDebit18)
  })

  it('quotes a native payment with value equal to the amount', async () => {
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('0.5'), mode: 'native', config })
    expect(q.status).toBe('ready')
    expect(q.request?.to).toBe(BOB)
    expect(q.request?.value).toBe(parseUsdc('0.5'))
    expect(q.fee?.gasEstimate).toBe(21_000n)
  })

  it('blocks when the payment fits but the fee budget does not', async () => {
    const amount = toWholeMicro(1_635_832_916_707_859_154n) // whole token balance, nothing left for gas
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: amount, mode: 'erc20', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers.map((b) => b.code)).toContain('INSUFFICIENT_GAS_FUNDS')
    expect(q.request).toBeDefined() // the would-be request is still shown for explanation
  })

  it('blocks a payment larger than the balance', async () => {
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('5'), mode: 'erc20', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers[0]?.code).toBe('INSUFFICIENT_FUNDS')
  })

  it('rejects precision the ERC-20 interface cannot represent', async () => {
    await expect(
      quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE + 1n, mode: 'erc20', config }),
    ).rejects.toMatchObject({ code: 'INVALID_PRECISION' })
  })

  it('rejects invalid and zero recipients before any RPC call', async () => {
    await expect(
      quoteExactPayment({ publicClient: client(), account: PAYER, recipient: '0x1234' as `0x${string}`, amount18: 1n, mode: 'native', config }),
    ).rejects.toMatchObject({ code: 'INVALID_RECIPIENT' })
    await expect(
      quoteExactPayment({ publicClient: client(), account: PAYER, recipient: '0x0000000000000000000000000000000000000000', amount18: 1n, mode: 'native', config }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_RECIPIENT' })
    expect(state.calls).toHaveLength(0)
  })

  it('refuses the wrong chain', async () => {
    state.chainId = 1
    await expect(
      quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: 1n * SCALE, mode: 'native', config }),
    ).rejects.toMatchObject({ code: 'WRONG_CHAIN' })
  })

  it('blocks while an earlier transaction is pending', async () => {
    state.nonces.set(PAYER.toLowerCase(), { latest: 4, pending: 5 })
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers[0]?.code).toBe('STALE_QUOTE')
  })

  it('blocks blocklisted recipients', async () => {
    state.blacklisted.add(BOB.toLowerCase())
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers.some((b) => b.code === 'UNSUPPORTED_RECIPIENT')).toBe(true)
  })

  it('surfaces simulation failures such as a reverting contract recipient', async () => {
    state.code.set(BOB.toLowerCase(), '0x6080')
    state.revertTo.set(BOB.toLowerCase(), 'no receive')
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers[0]?.code).toBe('SIMULATION_FAILED')
    expect(q.warnings.some((w) => w.code === 'RECIPIENT_IS_CONTRACT')).toBe(true)
  })

  it('reports RPC outages as RPC_UNAVAILABLE', async () => {
    state.rpcDown = true
    await expect(
      quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config }),
    ).rejects.toMatchObject({ code: 'RPC_UNAVAILABLE' })
  })
})

function toWholeMicro(native18: bigint): bigint {
  return (native18 / SCALE) * SCALE
}

describe('quoteMaxPayment', () => {
  it('native max equals balance minus the fee budget, exactly', async () => {
    const q = await quoteMaxPayment({ publicClient: client(), account: PAYER, recipient: BOB, mode: 'native', config })
    expect(q.status).toBe('ready')
    const amount = q.lines[0]!.amount18
    expect(amount + q.fee!.maxFeeBudget18).toBe(q.balance.native18)
    expect(q.minimumRemaining18).toBe(0n)
    expect(q.warnings.some((w) => w.code === 'RESIDUAL_AFTER_MAX')).toBe(true)
  })

  it('erc20 max is the largest whole micro-USDC under the budget', async () => {
    const q = await quoteMaxPayment({ publicClient: client(), account: PAYER, recipient: BOB, mode: 'erc20', config })
    expect(q.status).toBe('ready')
    const t6 = q.tokenAmount6!
    expect(t6 * SCALE + q.fee!.maxFeeBudget18 <= q.balance.native18).toBe(true)
    expect((t6 + 1n) * SCALE + q.fee!.maxFeeBudget18 > q.balance.native18).toBe(true)
    expect(q.iterations).toBeLessThanOrEqual(4)
  })

  it('blocks when the balance cannot even cover the fee budget', async () => {
    setBalance(state, PAYER, 1_000_000_000n)
    const q = await quoteMaxPayment({ publicClient: client(), account: PAYER, recipient: BOB, mode: 'native', config })
    expect(q.status).toBe('blocked')
    expect(q.blockers[0]?.code).toBe('INSUFFICIENT_GAS_FUNDS')
  })

  it('a naive full-balance ERC-20 transfer fails the same fee-aware simulation', async () => {
    // Baseline: transfer balanceOf() in full with the same fee caps LastDollar would use.
    const naive = await quoteExactPayment({
      publicClient: client(),
      account: PAYER,
      recipient: BOB,
      amount18: toWholeMicro(1_635_832_916_707_859_154n),
      mode: 'erc20',
      config,
    })
    expect(naive.status).toBe('blocked')
    const max = await quoteMaxPayment({ publicClient: client(), account: PAYER, recipient: BOB, mode: 'erc20', config })
    expect(max.status).toBe('ready')
  })
})

describe('quoteBatchPayment', () => {
  it('quotes one splitter call with value equal to the total', async () => {
    const q = await quoteBatchPayment({
      publicClient: client(),
      account: PAYER,
      config,
      payments: [
        { recipient: BOB, amount18: parseUsdc('0.1') },
        { recipient: CAROL, amount18: parseUsdc('0.2') },
      ],
    })
    expect(q.status).toBe('ready')
    expect(q.request?.to).toBe(config.splitter)
    expect(q.request?.value).toBe(parseUsdc('0.3'))
    expect(q.recipientTotal18).toBe(parseUsdc('0.3'))
  })

  it('requires a deployed splitter', async () => {
    state.code.delete(config.splitter!.toLowerCase())
    await expect(
      quoteBatchPayment({ publicClient: client(), account: PAYER, config, payments: [{ recipient: BOB, amount18: SCALE }] }),
    ).rejects.toMatchObject({ code: 'SPLITTER_UNAVAILABLE' })
    await expect(
      quoteBatchPayment({ publicClient: client(), account: PAYER, config: mockConfig({ splitter: undefined }), payments: [{ recipient: BOB, amount18: SCALE }] }),
    ).rejects.toBeInstanceOf(LastDollarError)
  })

  it('rejects invalid batches before quoting', async () => {
    await expect(quoteBatchPayment({ publicClient: client(), account: PAYER, config, payments: [] })).rejects.toMatchObject({ code: 'INVALID_BATCH' })
  })

  it('warns about repeated recipients without merging them', async () => {
    const q = await quoteBatchPayment({
      publicClient: client(),
      account: PAYER,
      config,
      payments: [
        { recipient: BOB, amount18: SCALE },
        { recipient: BOB, amount18: 2n * SCALE },
      ],
    })
    expect(q.lines).toHaveLength(2)
    expect(q.warnings.some((w) => w.code === 'DUPLICATE_RECIPIENT')).toBe(true)
  })
})

describe('preparePayment and revalidatePlan', () => {
  it('refuses to prepare a blocked quote', async () => {
    const q = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('5'), mode: 'native', config })
    expect(() => preparePayment(q)).toThrowError(LastDollarError)
  })

  it('stays valid when nothing material changed', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'erc20', config }),
    )
    state.blockNumber += 5n
    const r = await revalidatePlan({ publicClient: client(), plan, config })
    expect(r.status).toBe('valid')
  })

  it('exact plan survives an unrelated balance increase', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config }),
    )
    setBalance(state, PAYER, 5n * 10n ** 18n)
    expect((await revalidatePlan({ publicClient: client(), plan, config })).status).toBe('valid')
  })

  it('max plan changes when the balance changes, and lists the new amount', async () => {
    const plan = preparePayment(await quoteMaxPayment({ publicClient: client(), account: PAYER, recipient: BOB, mode: 'native', config }))
    setBalance(state, PAYER, 1_000_000_000_000_000_000n)
    const r = await revalidatePlan({ publicClient: client(), plan, config })
    expect(r.status).toBe('changed')
    if (r.status !== 'valid') expect(r.changes.some((c) => c.field === 'amount 1')).toBe(true)
  })

  it('changes when the nonce moved (another transaction was sent)', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config }),
    )
    state.nonces.set(PAYER.toLowerCase(), { latest: 1, pending: 1 })
    const r = await revalidatePlan({ publicClient: client(), plan, config })
    expect(r.status).toBe('changed')
  })

  it('changes when the base fee rises above the reviewed cap', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config }),
    )
    state.baseFee = 60_000_000_000n
    state.nextBaseFee = 60_000_000_000n
    const r = await revalidatePlan({ publicClient: client(), plan, config })
    expect(r.status).toBe('changed')
    if (r.status !== 'valid') expect(r.changes.some((c) => c.field === 'maximum fee budget')).toBe(true)
  })

  it('becomes blocked when the balance can no longer cover it', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: SCALE, mode: 'native', config }),
    )
    setBalance(state, PAYER, 1_000n)
    const r = await revalidatePlan({ publicClient: client(), plan, config })
    expect(r.status).toBe('blocked')
  })

  it('rejects an ERC-20 retained-cap plan when its transfer plus reviewed fee budget no longer fits', async () => {
    const plan = preparePayment(
      await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('1'), mode: 'erc20', config }),
    )
    // A lower fresh fee suggestion makes a fresh quote affordable.  The old
    // request still authorizes its original fee cap and must not be signed.
    state.priorityFee = 0n
    state.callIgnoresAffordability = true
    const retainedDebit = plan.quote.recipientTotal18 + plan.request.gas * plan.request.maxFeePerGas
    setBalance(state, PAYER, retainedDebit - 1n)
    const fresh = await quoteExactPayment({ publicClient: client(), account: PAYER, recipient: BOB, amount18: parseUsdc('1'), mode: 'erc20', config })
    expect(fresh.status).toBe('ready')
    const result = await revalidatePlan({ publicClient: client(), plan, config })
    expect(result.status).not.toBe('valid')
  })
})
