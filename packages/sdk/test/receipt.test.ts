import { describe, expect, it } from 'vitest'
import {
  createPublicClient,
  custom,
  formatTransaction,
  formatTransactionReceipt,
  getAddress,
  type Hash,
  type PublicClient,
} from 'viem'
import fixtures from './fixtures/mainnet-receipts.json' with { type: 'json' }
import { extractTransfers, verifyPaymentReceipt } from '../src/receipt.js'
import { arcMainnet, SCALE } from '../src/config.js'
import type { PaymentQuote } from '../src/types.js'

type Fixture = (typeof fixtures)['erc20Transfer']

function clientFor(fx: Fixture | undefined, opts: { pending?: boolean } = {}): PublicClient {
  return createPublicClient({
    transport: custom({
      async request({ method }: { method: string }) {
        if (method === 'eth_chainId') return '0x13b2'
        if (method === 'eth_getTransactionByHash') return fx ? fx.transaction : null
        if (method === 'eth_getTransactionReceipt') return fx && !opts.pending ? fx.receipt : null
        if (method === 'eth_getBlockByNumber') return { ...fx?.block, transactions: [] }
        throw new Error(`unsupported ${method}`)
      },
    }),
  }) as PublicClient
}

const erc20 = fixtures.erc20Transfer
const native = fixtures.nativeTransfer

describe('extractTransfers (real Arc mainnet logs)', () => {
  it('counts an ERC-20 transfer once even though Arc emits two Transfer logs', () => {
    const receipt = formatTransactionReceipt(erc20.receipt as never)
    expect(receipt.logs).toHaveLength(2)
    const { transfers, mirrored } = extractTransfers(receipt, arcMainnet)
    expect(mirrored).toBe(1)
    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.source).toBe('erc20-log')
    expect(transfers[0]?.amount6).toBe(418_462n)
    expect(transfers[0]?.amount18).toBe(418_462n * SCALE)
  })

  it('reads native transfers from the EIP-7708 system log', () => {
    const receipt = formatTransactionReceipt(native.receipt as never)
    const { transfers, mirrored } = extractTransfers(receipt, arcMainnet)
    expect(mirrored).toBe(0)
    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.source).toBe('native-log')
    expect(transfers[0]?.amount18).toBe(BigInt(native.transaction.value))
  })
})

describe('verifyPaymentReceipt', () => {
  it('reports an observed ERC-20 payment with the actual fee', async () => {
    const r = await verifyPaymentReceipt({ publicClient: clientFor(erc20), hash: erc20.transaction.hash as Hash })
    expect(r.status).toBe('observed')
    expect(r.operation).toBe('erc20-transfer')
    expect(r.delivered).toEqual([{ recipient: getAddress('0x8cf6d6642baefa6385541a3be10c594b9ba9faf0'), amount18: 418_462n * SCALE }])
    expect(r.actualFee18).toBe(BigInt(erc20.receipt.gasUsed) * BigInt(erc20.receipt.effectiveGasPrice))
    expect(r.blockTimestamp).toBe(BigInt(erc20.block.timestamp))
  })

  it('verifies against an expectation and flags wallet-modified parameters', async () => {
    const tx = formatTransaction(erc20.transaction as never)
    const quote = {
      kind: 'exact',
      mode: 'erc20',
      chainId: 5042,
      account: tx.from,
      lines: [{ recipient: getAddress('0x8cf6d6642baefa6385541a3be10c594b9ba9faf0'), amount18: 418_462n * SCALE }],
      fee: { estimatedFee18: 1n, maxFeeBudget18: 10n ** 18n },
      request: { gas: tx.gas + 1n, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas, nonce: tx.nonce, value: 0n, data: tx.input, to: tx.to },
    } as unknown as PaymentQuote
    const r = await verifyPaymentReceipt({ publicClient: clientFor(erc20), hash: tx.hash, expected: quote })
    expect(r.status).toBe('verified')
    expect(r.comparison?.feeWithinBudget).toBe(true)
    expect(r.comparison?.walletModifiedParameters).toBe(true)
    expect(r.comparison?.modifiedFields).toEqual(['gas limit'])
  })

  it('marks a different amount as a mismatch, never as verified', async () => {
    const tx = formatTransaction(erc20.transaction as never)
    const quote = {
      kind: 'exact',
      mode: 'erc20',
      chainId: 5042,
      account: tx.from,
      lines: [{ recipient: getAddress('0x8cf6d6642baefa6385541a3be10c594b9ba9faf0'), amount18: 418_463n * SCALE }],
    } as unknown as PaymentQuote
    const r = await verifyPaymentReceipt({ publicClient: clientFor(erc20), hash: tx.hash, expected: quote })
    expect(r.status).toBe('mismatch')
    expect(r.issues.join()).toMatch(/Payout 1 delivered/)
  })

  it('marks the wrong operation type as a mismatch', async () => {
    const tx = formatTransaction(native.transaction as never)
    const quote = { kind: 'exact', mode: 'erc20', chainId: 5042, account: tx.from, lines: [{ recipient: tx.to, amount18: tx.value }] } as unknown as PaymentQuote
    const r = await verifyPaymentReceipt({ publicClient: clientFor(native), hash: tx.hash, expected: quote })
    expect(r.status).toBe('mismatch')
  })

  it('never reports a missing receipt as success or failure', async () => {
    const pending = await verifyPaymentReceipt({ publicClient: clientFor(erc20, { pending: true }), hash: erc20.transaction.hash as Hash })
    expect(pending.status).toBe('pending')
    const missing = await verifyPaymentReceipt({ publicClient: clientFor(undefined), hash: `0x${'12'.repeat(32)}` })
    expect(missing.status).toBe('not-found')
  })

  it('reports reverted transactions with their fee', async () => {
    const reverted = { ...erc20, receipt: { ...erc20.receipt, status: '0x0', logs: [] } }
    const r = await verifyPaymentReceipt({ publicClient: clientFor(reverted), hash: erc20.transaction.hash as Hash })
    expect(r.status).toBe('reverted')
    expect(r.delivered).toEqual([])
    expect(r.actualFee18).toBeGreaterThan(0n)
  })
})
