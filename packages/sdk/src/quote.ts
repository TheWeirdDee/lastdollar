import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { splitterAbi, usdcAbi } from './abis.js'
import { assertClientChain, snapshotFrom } from './balance.js'
import { validateBatchLines } from './batch.js'
import { arcMainnet, SCALE, type ArcNetworkConfig } from './config.js'
import { LastDollarError, classifyError } from './errors.js'
import { buildFeeQuote, defaultFeePolicy, feeContextFromBlock, type FeeContext, type FeePolicy, type FeeQuote } from './fees.js'
import { checkExactAffordability, maxNativeAmount18, maxTokenAmount6, projectRemaining } from './math.js'
import { bigintReplacer, formatUsdc, isTokenRepresentable, toNative18 } from './units.js'
import type {
  BalanceSnapshot,
  PaymentIntent,
  PaymentLine,
  PaymentMode,
  PaymentQuote,
  QuoteIssue,
  TransactionRequestPlan,
} from './types.js'

export interface QuoteContext {
  publicClient: PublicClient
  /** The paying account. Its own wallet signs; the SDK never holds keys. */
  account: Address
  config?: ArcNetworkConfig
  feePolicy?: FeePolicy
  /** Quote lifetime in milliseconds before revalidation is mandatory. Default 60 000. */
  ttlMs?: number
}

export interface ExactPaymentInput extends QuoteContext {
  recipient: Address
  /** Amount to deliver in native units (18 decimals). Use `parseUsdc("12.50")`. */
  amount18: bigint
  mode: PaymentMode
  reference?: string
}

export interface MaxPaymentInput extends QuoteContext {
  recipient: Address
  mode: PaymentMode
  reference?: string
}

export interface BatchPaymentInput extends QuoteContext {
  payments: PaymentLine[]
}

interface Snapshot {
  balance: BalanceSnapshot
  nonce: number
  pendingNonce: number
  fees: FeeContext
}

const MAX_ITERATIONS = 4

async function readSnapshot(client: PublicClient, account: Address, config: ArcNetworkConfig, policy: FeePolicy): Promise<Snapshot> {
  await assertClientChain(client, config)
  try {
    const block = await client.getBlock({ blockTag: 'latest' })
    const blockNumber = block.number
    if (blockNumber === null) throw new LastDollarError('RPC_UNAVAILABLE', 'Latest block has no number.')
    const [native18, token6, nonce, pendingNonce, priority] = await Promise.all([
      client.getBalance({ address: account, blockNumber }),
      client.readContract({ address: config.usdc, abi: usdcAbi, functionName: 'balanceOf', args: [account], blockNumber }),
      client.getTransactionCount({ address: account, blockNumber }),
      client.getTransactionCount({ address: account, blockTag: 'pending' }),
      client.estimateMaxPriorityFeePerGas().catch(() => 0n),
    ])
    return {
      balance: snapshotFrom(account, config.chainId, blockNumber, native18, token6),
      nonce,
      pendingNonce,
      fees: feeContextFromBlock(block, priority, config, policy),
    }
  } catch (err) {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  }
}

function normalizeRecipient(recipient: string): Address {
  const raw = String(recipient ?? '').trim()
  if (!isAddress(raw, { strict: false })) throw new LastDollarError('INVALID_RECIPIENT', 'Enter a valid 0x address (40 hex characters).')
  const addr = getAddress(raw)
  if (addr === zeroAddress) throw new LastDollarError('UNSUPPORTED_RECIPIENT', 'Arc rejects value transfers to the zero address.')
  return addr
}

function buildCall(
  mode: PaymentMode,
  config: ArcNetworkConfig,
  lines: PaymentLine[],
  kind: 'single' | 'batch',
): { to: Address; data: Hex; value: bigint } {
  if (kind === 'batch') {
    if (!config.splitter) throw new LastDollarError('SPLITTER_UNAVAILABLE', 'No LastDollar splitter is configured for this network.')
    return {
      to: config.splitter,
      data: encodeFunctionData({
        abi: splitterAbi,
        functionName: 'pay',
        args: [lines.map((l) => l.recipient), lines.map((l) => l.amount18)],
      }),
      value: lines.reduce((s, l) => s + l.amount18, 0n),
    }
  }
  const line = lines[0]
  if (!line) throw new LastDollarError('INVALID_AMOUNT', 'No payment line.')
  if (mode === 'native') return { to: line.recipient, data: '0x', value: line.amount18 }
  return {
    to: config.usdc,
    data: encodeFunctionData({ abi: usdcAbi, functionName: 'transfer', args: [line.recipient, line.amount18 / SCALE] }),
    value: 0n,
  }
}

async function estimate(client: PublicClient, account: Address, call: { to: Address; data: Hex; value: bigint }): Promise<bigint> {
  return client.estimateGas({ account, to: call.to, data: call.data, value: call.value })
}

async function screenRecipients(
  client: PublicClient,
  config: ArcNetworkConfig,
  account: Address,
  lines: PaymentLine[],
  mode: PaymentMode,
  blockers: QuoteIssue[],
  warnings: QuoteIssue[],
): Promise<void> {
  const unique = [...new Set([account, ...lines.map((l) => l.recipient)])]
  const results = await Promise.all(
    unique.map(async (addr) => {
      const [blocked, code] = await Promise.all([
        client
          .readContract({ address: config.usdc, abi: usdcAbi, functionName: 'isBlacklisted', args: [addr] })
          .catch(() => undefined),
        addr === account ? Promise.resolve(undefined) : client.getCode({ address: addr }).catch(() => undefined),
      ])
      return { addr, blocked, code }
    }),
  )
  for (const r of results) {
    if (r.blocked === true) {
      blockers.push({
        code: 'UNSUPPORTED_RECIPIENT',
        message: r.addr === account ? 'Your address is restricted by USDC and cannot send.' : `${r.addr} is restricted by USDC and cannot receive.`,
      })
    }
    if (r.code && r.code !== '0x' && mode === 'native') {
      warnings.push({
        code: 'RECIPIENT_IS_CONTRACT',
        message: `${r.addr} is a contract. It must accept native USDC; the final simulation checks this.`,
      })
    }
  }
  if (lines.some((l) => l.recipient === account)) {
    warnings.push({ code: 'SELF_PAYMENT', message: 'The recipient is your own address. Only the network fee is spent.' })
  }
}

function fingerprint(parts: Record<string, unknown>): Hex {
  return keccak256(stringToHex(JSON.stringify(parts, bigintReplacer)))
}

interface AssembleInput {
  intent: PaymentIntent
  config: ArcNetworkConfig
  account: Address
  snapshot: Snapshot
  lines: PaymentLine[]
  mode: PaymentMode
  fee: FeeQuote | undefined
  call: { to: Address; data: Hex; value: bigint } | undefined
  blockers: QuoteIssue[]
  warnings: QuoteIssue[]
  iterations: number
  ttlMs: number
  simulate: (req: TransactionRequestPlan) => Promise<void>
}

async function assemble(a: AssembleInput): Promise<PaymentQuote> {
  const { snapshot, fee, lines, config } = a
  const recipientTotal18 = lines.reduce((s, l) => s + l.amount18, 0n)
  const estimatedFee18 = fee?.estimatedFee18 ?? 0n
  const budget18 = fee?.maxFeeBudget18 ?? 0n
  const remaining = projectRemaining(snapshot.balance.native18, recipientTotal18, estimatedFee18, budget18)

  if (snapshot.pendingNonce > snapshot.nonce) {
    a.blockers.push({
      code: 'STALE_QUOTE',
      message: 'This account has a transaction still pending. Wait for it to settle before quoting, because it changes the balance.',
    })
  }
  if (!snapshot.balance.viewsConsistent) {
    a.warnings.push({
      code: 'BALANCE_VIEWS_INCONSISTENT',
      message: 'The ERC-20 balance does not equal the truncated native balance at this block. Proceed with care.',
    })
  }
  if (snapshot.fees.nextBaseFeeSource !== 'extraData') {
    a.warnings.push({ code: 'NEXT_BASE_FEE_FALLBACK', message: 'Next base fee unavailable; the latest base fee was used.' })
  }
  if (!config.isMainnet) a.warnings.push({ code: 'TEST_NETWORK', message: `${config.name} is not Arc mainnet.` })

  let request: TransactionRequestPlan | undefined
  let simulation: PaymentQuote['simulation'] = 'skipped'
  if (fee && a.call) {
    request = {
      type: 'eip1559',
      chainId: config.chainId,
      from: a.account,
      to: a.call.to,
      data: a.call.data,
      value: a.call.value,
      gas: fee.gasLimit,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
      nonce: snapshot.nonce,
    }
    if (a.blockers.length === 0) {
      try {
        await a.simulate(request)
        simulation = 'passed'
      } catch (err) {
        simulation = 'failed'
        const e = classifyError(err, 'SIMULATION_FAILED')
        a.blockers.push({ code: e.code === 'UNKNOWN' ? 'SIMULATION_FAILED' : e.code, message: e.message })
      }
    }
  }

  const tokenAmount6 = a.mode === 'erc20' && a.intent.kind !== 'batch' && lines[0] ? lines[0].amount18 / SCALE : undefined
  const now = Date.now()
  const id = fingerprint({
    intent: a.intent,
    lines,
    request,
    balance: snapshot.balance.native18,
    token: snapshot.balance.token6,
    block: snapshot.balance.blockNumber,
  })
  return {
    version: 1,
    id,
    intent: a.intent,
    kind: a.intent.kind,
    mode: a.mode,
    chainId: config.chainId,
    isMainnet: config.isMainnet,
    account: a.account,
    lines,
    recipientTotal18,
    tokenAmount6,
    balance: snapshot.balance,
    nonce: snapshot.nonce,
    pendingNonce: snapshot.pendingNonce,
    fee,
    maxDebit18: recipientTotal18 + budget18,
    estimatedDebit18: recipientTotal18 + estimatedFee18,
    estimatedRemaining18: remaining.estimatedRemaining18,
    minimumRemaining18: remaining.minimumRemaining18,
    status: a.blockers.length === 0 && request ? 'ready' : 'blocked',
    blockers: a.blockers,
    warnings: a.warnings,
    request,
    simulation,
    iterations: a.iterations,
    createdAt: now,
    expiresAt: now + a.ttlMs,
    splitter: a.intent.kind === 'batch' ? config.splitter : undefined,
  }
}

function simulator(client: PublicClient) {
  return async (req: TransactionRequestPlan) => {
    // Supplying the final gas limit and fee caps makes the node check value + gas * maxFeePerGas
    // against the balance, exactly as it will when the signed transaction arrives.
    await client.call({
      account: req.from,
      to: req.to,
      data: req.data,
      value: req.value,
      gas: req.gas,
      maxFeePerGas: req.maxFeePerGas,
      maxPriorityFeePerGas: req.maxPriorityFeePerGas,
    })
  }
}

function blockerFromEstimate(err: unknown): QuoteIssue {
  const e = classifyError(err, 'SIMULATION_FAILED')
  if (e.code === 'INSUFFICIENT_GAS_FUNDS') return { code: 'INSUFFICIENT_FUNDS', message: 'The balance cannot cover this payment.' }
  if (/exceeds balance|transfer amount exceeds/i.test(e.message)) {
    return { code: 'INSUFFICIENT_FUNDS', message: 'The balance cannot cover this payment.' }
  }
  return { code: e.code === 'UNKNOWN' ? 'SIMULATION_FAILED' : e.code, message: e.message }
}

/** Quotes delivering an exact amount to one recipient. */
export async function quoteExactPayment(input: ExactPaymentInput): Promise<PaymentQuote> {
  const config = input.config ?? arcMainnet
  const policy = input.feePolicy ?? defaultFeePolicy
  const client = input.publicClient
  const account = getAddress(input.account)
  const recipient = normalizeRecipient(input.recipient)
  if (input.amount18 <= 0n) throw new LastDollarError('INVALID_AMOUNT', 'Amount must be greater than zero.')
  if (input.mode === 'erc20' && !isTokenRepresentable(input.amount18)) {
    throw new LastDollarError('INVALID_PRECISION', 'ERC-20 USDC transfers support at most 6 decimal places.')
  }
  const intent: PaymentIntent = { kind: 'exact', mode: input.mode, recipient, amount18: input.amount18, reference: input.reference }
  const lines: PaymentLine[] = [{ recipient, amount18: input.amount18, reference: input.reference }]
  const snapshot = await readSnapshot(client, account, config, policy)
  const blockers: QuoteIssue[] = []
  const warnings: QuoteIssue[] = []
  await screenRecipients(client, config, account, lines, input.mode, blockers, warnings)

  const call = buildCall(input.mode, config, lines, 'single')
  let gas: bigint | undefined
  try {
    gas = await estimate(client, account, call)
  } catch (err) {
    blockers.push(blockerFromEstimate(err))
    // Estimate a minimal payment so the fee can still be shown next to the shortfall.
    try {
      const minimal = buildCall(input.mode, config, [{ recipient, amount18: SCALE }], 'single')
      gas = await estimate(client, account, minimal)
    } catch {
      gas = undefined
    }
  }
  const fee = gas === undefined ? undefined : buildFeeQuote(gas, snapshot.fees, policy)
  if (fee) {
    const aff = checkExactAffordability({
      balance18: snapshot.balance.native18,
      recipientTotal18: input.amount18,
      feeBudget18: fee.maxFeeBudget18,
      tokenBalance6: input.mode === 'erc20' ? snapshot.balance.token6 : undefined,
      tokenAmount6: input.mode === 'erc20' ? input.amount18 / SCALE : undefined,
    })
    if (!aff.affordable && !blockers.some((b) => b.code === 'INSUFFICIENT_FUNDS')) {
      blockers.push(
        aff.paymentExceedsBalance || aff.tokenBalanceTooLow
          ? { code: 'INSUFFICIENT_FUNDS', message: `The payment exceeds the available balance by ${formatUsdc(aff.shortfall18)} USDC including the fee budget.` }
          : {
              code: 'INSUFFICIENT_GAS_FUNDS',
              message: `The balance covers the payment but not the maximum fee budget. Short by ${formatUsdc(aff.shortfall18)} USDC.`,
            },
      )
    }
  }
  return assemble({
    intent,
    config,
    account,
    snapshot,
    lines,
    mode: input.mode,
    fee,
    call: gas === undefined ? undefined : call,
    blockers,
    warnings,
    iterations: 1,
    ttlMs: input.ttlMs ?? 60_000,
    simulate: simulator(client),
  })
}

/**
 * Quotes the largest payment the account can make after reserving a bounded fee budget.
 * Estimation and amount depend on each other, so this runs a bounded loop: estimate, compute the
 * amount under that budget, re-estimate the final call, and repeat only if gas grew past the limit.
 */
export async function quoteMaxPayment(input: MaxPaymentInput): Promise<PaymentQuote> {
  const config = input.config ?? arcMainnet
  const policy = input.feePolicy ?? defaultFeePolicy
  const client = input.publicClient
  const account = getAddress(input.account)
  const recipient = normalizeRecipient(input.recipient)
  const intent: PaymentIntent = { kind: 'max', mode: input.mode, recipient, reference: input.reference }
  const snapshot = await readSnapshot(client, account, config, policy)
  const blockers: QuoteIssue[] = []
  const warnings: QuoteIssue[] = []
  const { native18, token6 } = snapshot.balance

  const amountFor = (fee: FeeQuote): bigint =>
    input.mode === 'native'
      ? maxNativeAmount18(native18, fee.maxFeeBudget18)
      : toNative18(maxTokenAmount6(native18, fee.maxFeeBudget18, token6))

  // Initial candidate: the whole balance. Estimation without fee fields only checks value <= balance.
  let candidate = input.mode === 'native' ? native18 : toNative18(token6)
  if (candidate === 0n) candidate = SCALE
  let fee: FeeQuote | undefined
  let amount18 = 0n
  let iterations = 0
  let estimationError: unknown

  for (; iterations < MAX_ITERATIONS; ) {
    iterations++
    let gas: bigint
    try {
      gas = await estimate(client, account, buildCall(input.mode, config, [{ recipient, amount18: candidate }], 'single'))
    } catch (err) {
      estimationError = err
      if (candidate > SCALE) {
        candidate = SCALE // fall back to a minimal amount; gas for direct transfers does not depend on size
        continue
      }
      break
    }
    estimationError = undefined
    const next = buildFeeQuote(gas, snapshot.fees, policy)
    if (fee && next.gasEstimate <= fee.gasLimit) {
      // The final call fits inside the previously reserved gas limit: keep the earlier, larger reservation.
      break
    }
    fee = next
    amount18 = amountFor(fee)
    if (amount18 === 0n) break
    if (candidate === amount18) break
    candidate = amount18
  }

  if (!fee) {
    blockers.push(estimationError ? blockerFromEstimate(estimationError) : { code: 'SIMULATION_FAILED', message: 'Gas could not be estimated.' })
  } else if (amount18 === 0n) {
    blockers.push({
      code: 'INSUFFICIENT_GAS_FUNDS',
      message: `The balance (${formatUsdc(native18)} USDC) does not exceed the maximum fee budget (${formatUsdc(fee.maxFeeBudget18)} USDC).`,
    })
  }

  const lines: PaymentLine[] = [{ recipient, amount18, reference: input.reference }]
  if (amount18 > 0n) await screenRecipients(client, config, account, lines, input.mode, blockers, warnings)
  if (fee && amount18 > 0n) {
    const left = native18 - amount18 - fee.estimatedFee18
    warnings.push({
      code: 'RESIDUAL_AFTER_MAX',
      message:
        input.mode === 'erc20'
          ? `About ${formatUsdc(left > 0n ? left : 0n)} USDC should remain: the unused part of the fee budget plus any balance below one micro-USDC, which the ERC-20 interface cannot move.`
          : `About ${formatUsdc(left > 0n ? left : 0n)} USDC should remain: the part of the fee budget the network does not charge.`,
    })
  }
  return assemble({
    intent,
    config,
    account,
    snapshot,
    lines,
    mode: input.mode,
    fee,
    call: fee && amount18 > 0n ? buildCall(input.mode, config, lines, 'single') : undefined,
    blockers,
    warnings,
    iterations,
    ttlMs: input.ttlMs ?? 60_000,
    simulate: simulator(client),
  })
}

/** Quotes an atomic native-USDC batch through the LastDollarSplitter contract. One transaction, no approval. */
export async function quoteBatchPayment(input: BatchPaymentInput): Promise<PaymentQuote> {
  const config = input.config ?? arcMainnet
  const policy = input.feePolicy ?? defaultFeePolicy
  const client = input.publicClient
  const account = getAddress(input.account)
  const validation = validateBatchLines(input.payments, { payer: account })
  if (validation.errors.length > 0) {
    throw new LastDollarError('INVALID_BATCH', validation.errors.map((e) => e.message).join(' '), {
      details: { errors: validation.errors },
    })
  }
  if (!config.splitter) throw new LastDollarError('SPLITTER_UNAVAILABLE', 'No LastDollar splitter is configured for this network.')
  const lines = validation.lines
  const intent: PaymentIntent = { kind: 'batch', mode: 'native', lines }
  const snapshot = await readSnapshot(client, account, config, policy)
  const blockers: QuoteIssue[] = []
  const warnings: QuoteIssue[] = [...validation.warnings.filter((w) => w.code !== 'SELF_PAYMENT')]

  const code = await client.getCode({ address: config.splitter }).catch((err: unknown) => {
    throw classifyError(err, 'RPC_UNAVAILABLE')
  })
  if (!code || code === '0x') {
    throw new LastDollarError('SPLITTER_UNAVAILABLE', `No contract code at the configured splitter ${config.splitter}.`)
  }
  await screenRecipients(client, config, account, lines, 'native', blockers, warnings)

  const call = buildCall('native', config, lines, 'batch')
  let gas: bigint | undefined
  try {
    gas = await estimate(client, account, call)
  } catch (err) {
    blockers.push(blockerFromEstimate(err))
    gas = undefined
  }
  const fee = gas === undefined ? undefined : buildFeeQuote(gas, snapshot.fees, policy)
  if (fee) {
    const aff = checkExactAffordability({
      balance18: snapshot.balance.native18,
      recipientTotal18: validation.total18,
      feeBudget18: fee.maxFeeBudget18,
    })
    if (!aff.affordable) {
      blockers.push({
        code: aff.paymentExceedsBalance ? 'INSUFFICIENT_FUNDS' : 'INSUFFICIENT_GAS_FUNDS',
        message: `The batch total plus the maximum fee budget exceeds the balance by ${formatUsdc(aff.shortfall18)} USDC.`,
      })
    }
  }
  return assemble({
    intent,
    config,
    account,
    snapshot,
    lines,
    mode: 'native',
    fee,
    call: gas === undefined ? undefined : call,
    blockers,
    warnings,
    iterations: 1,
    ttlMs: input.ttlMs ?? 60_000,
    simulate: simulator(client),
  })
}

/** Re-runs the quote for an existing intent against fresh chain state. */
export async function requote(
  quote: PaymentQuote,
  ctx: Omit<QuoteContext, 'account'>,
): Promise<PaymentQuote> {
  const base = { ...ctx, account: quote.account }
  const intent = quote.intent
  if (intent.kind === 'exact') {
    return quoteExactPayment({ ...base, recipient: intent.recipient, amount18: intent.amount18, mode: intent.mode, ...(intent.reference ? { reference: intent.reference } : {}) })
  }
  if (intent.kind === 'max') {
    return quoteMaxPayment({ ...base, recipient: intent.recipient, mode: intent.mode, ...(intent.reference ? { reference: intent.reference } : {}) })
  }
  return quoteBatchPayment({ ...base, payments: intent.lines })
}
