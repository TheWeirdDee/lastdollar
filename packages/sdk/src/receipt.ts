import {
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  isHash,
  type Address,
  type Hash,
  type Log,
  type PublicClient,
  type Transaction,
  type TransactionReceipt,
} from 'viem'
import { splitterAbi, TRANSFER_TOPIC, usdcAbi } from './abis.js'
import { arcMainnet, SCALE, type ArcNetworkConfig } from './config.js'
import { LastDollarError, classifyError } from './errors.js'
import type {
  ObservedTransfer,
  PaymentLine,
  PaymentQuote,
  PreparedPayment,
  ReceiptComparison,
  ReconciledOperation,
  ReconciledPayment,
  TransactionRequestPlan,
} from './types.js'

export interface VerifyReceiptInput {
  publicClient: PublicClient
  hash: Hash
  config?: ArcNetworkConfig
  /** The reviewed plan or quote. When supplied, delivered amounts are compared to it. */
  expected?: PreparedPayment | PaymentQuote | undefined
}

const lower = (a: string | null | undefined) => (a ?? '').toLowerCase()

function topicAddress(topic: string | undefined): Address {
  return getAddress(`0x${(topic ?? '').slice(26)}`)
}

function decodeTransferLog(log: Log): { from: Address; to: Address; value: bigint } | undefined {
  if (log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 3) return undefined
  try {
    return { from: topicAddress(log.topics[1]), to: topicAddress(log.topics[2]), value: BigInt(log.data) }
  } catch {
    return undefined
  }
}

function classify(tx: Transaction, config: ArcNetworkConfig): ReconciledOperation {
  if (!tx.to) return 'unknown'
  if (config.splitter && lower(tx.to) === lower(config.splitter) && tx.input.startsWith('0x')) {
    try {
      const d = decodeFunctionData({ abi: splitterAbi, data: tx.input })
      if (d.functionName === 'pay') return 'splitter-batch'
    } catch {
      return 'unknown'
    }
  }
  if (lower(tx.to) === lower(config.usdc)) {
    try {
      const d = decodeFunctionData({ abi: usdcAbi, data: tx.input })
      if (d.functionName === 'transfer') return 'erc20-transfer'
    } catch {
      return 'unknown'
    }
    return 'unknown'
  }
  if ((tx.input === '0x' || tx.input === undefined) && tx.value > 0n) return 'native-transfer'
  return 'unknown'
}

/**
 * Extracts transfers from a receipt, counting each economic movement once.
 *
 * Arc emits an EIP-7708 `Transfer` log (18 decimals) from its system address for native value
 * movement, and an ERC-20 `transfer` additionally emits the token's own `Transfer` log
 * (6 decimals) for the same funds. ERC-20 logs are preferred and matching native logs are
 * counted as mirrors, never added.
 */
export function extractTransfers(
  receipt: Pick<TransactionReceipt, 'logs'>,
  config: ArcNetworkConfig,
): { transfers: ObservedTransfer[]; mirrored: number } {
  const token: ObservedTransfer[] = []
  const native: ObservedTransfer[] = []
  const events: ObservedTransfer[] = []
  for (const log of receipt.logs) {
    const addr = lower(log.address)
    if (addr === lower(config.usdc)) {
      const t = decodeTransferLog(log)
      if (t) token.push({ from: t.from, to: t.to, amount18: t.value * SCALE, amount6: t.value, source: 'erc20-log', logIndex: log.logIndex ?? 0 })
    } else if (addr === lower(config.nativeTransferEmitter)) {
      const t = decodeTransferLog(log)
      if (t) native.push({ from: t.from, to: t.to, amount18: t.value, source: 'native-log', logIndex: log.logIndex ?? 0 })
    } else if (config.splitter && addr === lower(config.splitter)) {
      try {
        const ev = decodeEventLog({ abi: splitterAbi, data: log.data, topics: log.topics })
        if (ev.eventName === 'Payout') {
          events.push({
            from: getAddress(ev.args.payer),
            to: getAddress(ev.args.recipient),
            amount18: ev.args.amount,
            source: 'splitter-event',
            logIndex: log.logIndex ?? 0,
          })
        }
      } catch {
        /* not a splitter event */
      }
    }
  }
  const matchedToken = new Set<number>()
  const unmatchedNative = native.filter((n) => {
    const idx = token.findIndex(
      (t, i) => !matchedToken.has(i) && lower(t.from) === lower(n.from) && lower(t.to) === lower(n.to) && t.amount18 === n.amount18,
    )
    if (idx < 0) return true
    matchedToken.add(idx)
    return false
  })
  return {
    transfers: [...token, ...unmatchedNative, ...events].sort((a, b) => a.logIndex - b.logIndex),
    mirrored: matchedToken.size,
  }
}

function deliveredFor(
  op: ReconciledOperation,
  tx: Transaction,
  transfers: ObservedTransfer[],
  config: ArcNetworkConfig,
): { delivered: PaymentLine[]; issues: string[] } {
  const issues: string[] = []
  const from = lower(tx.from)
  if (op === 'erc20-transfer') {
    const delivered = transfers
      .filter((t) => t.source === 'erc20-log' && lower(t.from) === from)
      .map((t) => ({ recipient: t.to, amount18: t.amount18 }))
    return { delivered, issues }
  }
  if (op === 'native-transfer') {
    const delivered = transfers
      .filter((t) => t.source === 'native-log' && lower(t.from) === from)
      .map((t) => ({ recipient: t.to, amount18: t.amount18 }))
    if (delivered.length === 0) issues.push('No native transfer log found for this transaction.')
    return { delivered, issues }
  }
  if (op === 'splitter-batch') {
    const payouts = transfers.filter((t) => t.source === 'splitter-event' && lower(t.from) === from)
    // Cross-check every Payout event against Arc's native transfer logs from the splitter.
    const nativeOut = transfers.filter((t) => t.source === 'native-log' && lower(t.from) === lower(config.splitter))
    const remaining = [...nativeOut]
    for (const p of payouts) {
      const i = remaining.findIndex((n) => lower(n.to) === lower(p.to) && n.amount18 === p.amount18)
      if (i >= 0) remaining.splice(i, 1)
      else issues.push(`Payout to ${p.to} has no matching native transfer log.`)
    }
    if (remaining.length > 0) issues.push(`${remaining.length} native transfer(s) from the splitter have no Payout event.`)
    const inflow = transfers.filter((t) => t.source === 'native-log' && lower(t.from) === from && lower(t.to) === lower(config.splitter))
    const inflowTotal = inflow.reduce((s, t) => s + t.amount18, 0n)
    if (inflowTotal !== tx.value) issues.push('Native value into the splitter does not equal the transaction value.')
    return { delivered: payouts.map((p) => ({ recipient: p.to, amount18: p.amount18 })), issues }
  }
  return { delivered: [], issues: ['Transaction is not a recognised USDC payment.'] }
}

function compare(
  expected: PaymentQuote,
  request: TransactionRequestPlan | undefined,
  tx: Transaction,
  op: ReconciledOperation,
  delivered: PaymentLine[],
  actualFee18: bigint,
): ReceiptComparison {
  const mismatches: string[] = []
  const expectedOp: ReconciledOperation =
    expected.kind === 'batch' ? 'splitter-batch' : expected.mode === 'native' ? 'native-transfer' : 'erc20-transfer'
  if (op !== expectedOp) mismatches.push(`Expected a ${expectedOp}, found ${op}.`)
  if (lower(tx.from) !== lower(expected.account)) mismatches.push('Sender differs from the quoted account.')
  if (tx.chainId !== undefined && tx.chainId !== expected.chainId) mismatches.push('Chain differs from the quote.')
  if (delivered.length !== expected.lines.length) {
    mismatches.push(`Expected ${expected.lines.length} payout(s), observed ${delivered.length}.`)
  }
  expected.lines.forEach((line, i) => {
    const got = delivered[i]
    if (!got) return
    if (lower(got.recipient) !== lower(line.recipient)) mismatches.push(`Payout ${i + 1} went to ${got.recipient}, expected ${line.recipient}.`)
    if (got.amount18 !== line.amount18) mismatches.push(`Payout ${i + 1} delivered ${got.amount18} (18-dec units), expected ${line.amount18}.`)
  })
  const modifiedFields: string[] = []
  if (request) {
    if (tx.gas !== request.gas) modifiedFields.push('gas limit')
    if (tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== request.maxFeePerGas) modifiedFields.push('maxFeePerGas')
    if (tx.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== request.maxPriorityFeePerGas) modifiedFields.push('maxPriorityFeePerGas')
    if (tx.nonce !== request.nonce) modifiedFields.push('nonce')
    if (tx.value !== request.value) mismatches.push('Transaction value differs from the reviewed request.')
    if (lower(tx.input) !== lower(request.data)) mismatches.push('Calldata differs from the reviewed request.')
    if (lower(tx.to) !== lower(request.to)) mismatches.push('Destination differs from the reviewed request.')
  }
  const budget = expected.fee?.maxFeeBudget18
  if (budget !== undefined && actualFee18 > budget) {
    mismatches.push(`Actual network fee ${actualFee18} exceeds the reviewed maximum fee budget ${budget}. Delivery may have succeeded, but the reviewed fee limit was not met.`)
  }
  return {
    expectedLines: expected.lines,
    linesMatch: mismatches.length === 0,
    mismatches,
    estimatedFee18: expected.fee?.estimatedFee18,
    maxFeeBudget18: budget,
    feeWithinBudget: budget === undefined ? undefined : actualFee18 <= budget,
    walletModifiedParameters: modifiedFields.length > 0,
    modifiedFields,
  }
}

/**
 * Reads a transaction and its receipt from chain data and reconciles what actually happened.
 * Local notes are never used as evidence. A missing receipt is reported as `pending` or
 * `not-found`, never as success or failure.
 */
export async function verifyPaymentReceipt(input: VerifyReceiptInput): Promise<ReconciledPayment> {
  const config = input.config ?? arcMainnet
  const client = input.publicClient
  if (!isHash(input.hash)) throw new LastDollarError('INVALID_AMOUNT', 'Not a transaction hash.')
  const hash = input.hash
  const base = {
    hash,
    chainId: config.chainId,
    viaSplitter: false,
    transfers: [],
    delivered: [],
    deliveredTotal18: 0n,
    mirroredNativeLogs: 0,
    issues: [] as string[],
    checkedAt: Date.now(),
  }
  let chainId: number
  try {
    chainId = await client.getChainId()
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
  if (chainId !== config.chainId) throw new LastDollarError('WRONG_CHAIN', `RPC is on chain ${chainId}, expected ${config.chainId}.`)

  let tx: Transaction | undefined
  let receipt: TransactionReceipt | undefined
  try {
    ;[tx, receipt] = await Promise.all([
      client.getTransaction({ hash }).catch((e: unknown) => {
        if (/not.*found|could not be found/i.test(String((e as Error)?.message))) return undefined
        throw e
      }),
      client.getTransactionReceipt({ hash }).catch((e: unknown) => {
        if (/not.*found|could not be found/i.test(String((e as Error)?.message))) return undefined
        throw e
      }),
    ])
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
  if (!tx && !receipt) return { ...base, status: 'not-found', operation: 'unknown' }
  if (tx && !receipt) {
    return {
      ...base,
      status: 'pending',
      operation: classify(tx, config),
      viaSplitter: !!config.splitter && lower(tx.to) === lower(config.splitter),
      from: tx.from,
      to: tx.to,
    }
  }
  if (!tx || !receipt) {
    return { ...base, status: 'pending', operation: 'unknown', issues: ['Receipt found without transaction body; retry.'] }
  }

  const op = classify(tx, config)
  const actualFee18 = receipt.gasUsed * receipt.effectiveGasPrice
  let blockTimestamp: bigint | undefined
  try {
    blockTimestamp = (await client.getBlock({ blockNumber: receipt.blockNumber })).timestamp
  } catch {
    blockTimestamp = undefined
  }
  const { transfers, mirrored } = extractTransfers(receipt, config)
  const { delivered, issues } = receipt.status === 'success' ? deliveredFor(op, tx, transfers, config) : { delivered: [], issues: [] }
  const deliveredTotal18 = delivered.reduce((s, d) => s + d.amount18, 0n)

  const expectedQuote = input.expected ? ('quote' in input.expected ? input.expected.quote : input.expected) : undefined
  const expectedRequest = input.expected ? ('quote' in input.expected ? input.expected.request : input.expected.request) : undefined
  const comparison = expectedQuote ? compare(expectedQuote, expectedRequest, tx, op, delivered, actualFee18) : undefined

  let status: ReconciledPayment['status']
  if (receipt.status !== 'success') status = 'reverted'
  else if (comparison) status = comparison.linesMatch && issues.length === 0 ? 'verified' : 'mismatch'
  else status = 'observed'

  return {
    ...base,
    status,
    operation: op,
    viaSplitter: op === 'splitter-batch',
    from: tx.from,
    to: tx.to,
    blockNumber: receipt.blockNumber,
    blockTimestamp,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    actualFee18,
    submitted: {
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? undefined,
      value: tx.value,
      nonce: tx.nonce,
      type: tx.type,
      input: tx.input,
    },
    transfers,
    delivered,
    deliveredTotal18,
    mirroredNativeLogs: mirrored,
    comparison,
    issues: [...issues, ...(comparison?.mismatches ?? [])],
  }
}
