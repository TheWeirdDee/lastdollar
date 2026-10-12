// Executes the LastDollar mainnet proof plan with locally generated proof wallets, through the
// same SDK functions the web app uses, then verifies every receipt on a second RPC operator.
//
// Usage: pnpm proof:run              (plan only: prints every step and the projected cost)
//        pnpm proof:run --execute    (broadcasts the remaining steps; resumable)
//
// Every transfer goes between wallets generated for this proof, so transferred value stays
// recoverable; only network fees are spent. A fee cap stops the run before it is exceeded.
import { createWalletClient, encodeFunctionData, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  SDK_VERSION,
  arcMainnet,
  defaultFeePolicy,
  executePayment,
  formatUsdc,
  parseUsdc,
  preparePayment,
  quoteBatchPayment,
  quoteExactPayment,
  quoteMaxPayment,
  readArcBalance,
  toViemChain,
  verifyPaymentReceipt,
} from '@lastdollar/arc'
import { PRIMARY_RPC, PROOFS_FILE, SECONDARY_RPC, assertMainnet, clientFor, loadWallets, networkConfig, readJson, writeJson } from './lib.mjs'

const EXECUTE = process.argv.includes('--execute')
const FEE_CAP18 = parseUsdc(process.env.LASTDOLLAR_FEE_CAP ?? '0.05')
const config = networkConfig()
const primary = clientFor(PRIMARY_RPC, config)
const secondary = clientFor(SECONDARY_RPC, config)
await assertMainnet(primary, 'primary RPC')
await assertMainnet(secondary, 'verification RPC')

const w = loadWallets()
const acct = {
  payer: privateKeyToAccount(w.PAYER_PRIVATE_KEY),
  // Recipient B only receives, so its address is enough.
  b: w.RECIPIENT_B_PRIVATE_KEY ? privateKeyToAccount(w.RECIPIENT_B_PRIVATE_KEY) : { address: w.RECIPIENT_B_ADDRESS },
  c: privateKeyToAccount(w.RECIPIENT_C_PRIVATE_KEY),
  d: privateKeyToAccount(w.RECIPIENT_D_PRIVATE_KEY),
}
const wallet = (a) => createWalletClient({ account: a, chain: toViemChain(config), transport: http(PRIMARY_RPC) })

const proofs = readJson(PROOFS_FILE, {
  schema: 1,
  description: 'LastDollar public evidence. Integer amounts are decimal strings in base units: *18 = native 18-decimal USDC, *6 = ERC-20 6-decimal USDC.',
  network: { name: 'Arc', chainId: 5042, explorer: arcMainnet.explorerUrl, usdc: arcMainnet.usdc },
  wallets: {},
  entries: [],
})
proofs.wallets = { payer: acct.payer.address, recipientB: acct.b.address, recipientC: acct.c.address, recipientD: acct.d.address }
proofs.splitter = config.splitter ?? null
const done = (id) => proofs.entries.some((e) => e.id === id && (e.result === 'verified' || e.evidenceType === 'simulation'))
const spentFees = () => proofs.entries.filter((e) => e.evidenceType === 'mainnet').reduce((s, e) => s + BigInt(e.actual?.fee18 ?? '0'), 0n)
const save = () => writeJson(PROOFS_FILE, proofs)

function linesOut(lines) {
  return lines.map((l) => ({ recipient: l.recipient, amount18: l.amount18 }))
}

async function runPayment(id, label, signer, quoteFn, extra = {}) {
  if (done(id)) {
    console.log(`[skip] ${id} already verified`)
    return
  }
  const quote = await quoteFn()
  const budget = quote.fee?.maxFeeBudget18 ?? 0n
  console.log(`\n[${id}] ${label}`)
  console.log(`  status ${quote.status}; recipients ${quote.lines.map((l) => `${l.recipient}=${formatUsdc(l.amount18, { maxDecimals: 18 })}`).join(', ')}`)
  console.log(`  estimated fee ${formatUsdc(quote.fee?.estimatedFee18 ?? 0n)} USDC, max fee budget ${formatUsdc(budget)} USDC`)
  if (quote.status !== 'ready') {
    console.log(`  blocked: ${quote.blockers.map((b) => `${b.code}: ${b.message}`).join('; ')}`)
    if (EXECUTE) throw new Error(`${id} is blocked; stopping.`)
    return
  }
  if (spentFees() + budget > FEE_CAP18) throw new Error(`Fee cap ${formatUsdc(FEE_CAP18)} USDC would be exceeded; stopping.`)
  if (!EXECUTE) return

  const plan = preparePayment(quote)
  const senderBefore = await readArcBalance({ publicClient: primary, address: signer.address, config })
  const result = await executePayment({
    walletClient: wallet(signer),
    publicClient: primary,
    plan,
    config,
    onUpdate: (u) => console.log(`  ${u.status}${u.hash ? ` ${u.hash}` : ''}`),
  })
  const independent = await verifyPaymentReceipt({ publicClient: secondary, hash: result.finalHash, config, expected: plan })
  const r = result.receipt
  const senderAfter = await readArcBalance({ publicClient: primary, address: signer.address, config, blockNumber: r.blockNumber })
  const agree =
    independent.status === r.status &&
    independent.actualFee18 === r.actualFee18 &&
    JSON.stringify(linesOut(independent.delivered), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) ===
      JSON.stringify(linesOut(r.delivered), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  const entry = {
    id,
    label,
    evidenceType: 'mainnet',
    kind: quote.kind,
    mode: quote.mode,
    chainId: 5042,
    hash: result.finalHash,
    blockNumber: r.blockNumber,
    blockTimestamp: r.blockTimestamp,
    from: signer.address,
    to: r.to,
    splitter: quote.kind === 'batch' ? config.splitter : undefined,
    intended: linesOut(quote.lines),
    delivered: linesOut(r.delivered),
    tokenAmount6: quote.tokenAmount6,
    quote: {
      blockNumber: quote.balance.blockNumber,
      balance18: quote.balance.native18,
      token6: quote.balance.token6,
      gasEstimate: quote.fee.gasEstimate,
      gasLimit: quote.fee.gasLimit,
      maxFeePerGas: quote.fee.maxFeePerGas,
      maxPriorityFeePerGas: quote.fee.maxPriorityFeePerGas,
      estimatedFee18: quote.fee.estimatedFee18,
      maxFeeBudget18: quote.fee.maxFeeBudget18,
      maxDebit18: quote.maxDebit18,
      iterations: quote.iterations,
      feePolicy: defaultFeePolicy,
    },
    actual: {
      gasUsed: r.gasUsed,
      effectiveGasPrice: r.effectiveGasPrice,
      fee18: r.actualFee18,
      feeWithinBudget: r.comparison?.feeWithinBudget,
      walletModifiedParameters: r.comparison?.walletModifiedParameters,
      mirroredNativeLogs: r.mirroredNativeLogs,
    },
    sender: {
      before18: senderBefore.native18,
      beforeToken6: senderBefore.token6,
      after18: senderAfter.native18,
      afterToken6: senderAfter.token6,
      afterSubMicro18: senderAfter.subMicro18,
    },
    result: r.status,
    issues: r.issues,
    verification: {
      primaryRpc: PRIMARY_RPC,
      independentRpc: SECONDARY_RPC,
      independentStatus: independent.status,
      rpcsAgree: agree,
      verifiedAt: new Date().toISOString(),
    },
    sdkVersion: SDK_VERSION,
    ...extra,
  }
  proofs.entries = proofs.entries.filter((e) => e.id !== id).concat(entry)
  save()
  console.log(`  result ${r.status}; actual fee ${formatUsdc(r.actualFee18)} USDC; independent RPC ${independent.status}; agree=${agree}`)
  if (r.status !== 'verified' || !agree) throw new Error(`${id} did not verify cleanly; stopping for investigation.`)
}

/** Records what a naive full-balance transfer does under the same fee caps, via simulation only. */
async function naiveBaseline(id, label, signer, mode, recipient, reference) {
  if (done(id)) return
  const bal = await readArcBalance({ publicClient: primary, address: signer.address, config })
  const call =
    mode === 'erc20'
      ? {
          to: config.usdc,
          data: encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns (bool)']), functionName: 'transfer', args: [recipient, bal.token6] }),
          value: 0n,
        }
      : { to: recipient, data: '0x', value: bal.native18 }
  const params = { account: signer.address, ...call, gas: reference.fee.gasLimit, maxFeePerGas: reference.fee.maxFeePerGas, maxPriorityFeePerGas: reference.fee.maxPriorityFeePerGas }
  let outcome
  try {
    await primary.call(params)
    outcome = { simulated: 'success', message: 'The node accepted the naive transfer in simulation.' }
  } catch (e) {
    outcome = { simulated: 'failure', message: String(e.details ?? e.shortMessage ?? e.message).slice(0, 300) }
  }
  console.log(`\n[${id}] ${label}: ${outcome.simulated} (${outcome.message})`)
  if (!EXECUTE) return
  proofs.entries = proofs.entries.filter((e) => e.id !== id).concat({
    id,
    label,
    evidenceType: 'simulation',
    mode,
    chainId: 5042,
    blockNumber: bal.blockNumber,
    from: signer.address,
    attemptedAmount18: mode === 'erc20' ? bal.token6 * 10n ** 12n : bal.native18,
    balance18: bal.native18,
    token6: bal.token6,
    feeCaps: { gasLimit: reference.fee.gasLimit, maxFeePerGas: reference.fee.maxFeePerGas },
    outcome,
    method: 'eth_call with the same gas limit and fee caps LastDollar quoted for send-max',
    recordedAt: new Date().toISOString(),
  })
  save()
}

/** A competent fee-aware baseline written with plain viem, for comparison with the SDK's max. */
async function competentBaseline(id, signer, mode, recipient, sdkQuote) {
  if (done(id)) return
  const [balance, token6, block, gas] = await Promise.all([
    primary.getBalance({ address: signer.address }),
    primary.readContract({ address: config.usdc, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [signer.address] }),
    primary.getBlock(),
    primary.estimateGas({ account: signer.address, to: mode === 'erc20' ? config.usdc : recipient, data: mode === 'erc20' ? encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns (bool)']), functionName: 'transfer', args: [recipient, 1n] }) : '0x', value: mode === 'erc20' ? 0n : 1n }),
  ])
  // Typical hand-written approach: 2x base fee cap, gas estimate without margin.
  const maxFee = block.baseFeePerGas * 2n
  const budget = gas * maxFee
  const amount18 = mode === 'erc20' ? (balance > budget ? ((balance - budget) / 10n ** 12n < token6 ? (balance - budget) / 10n ** 12n : token6) * 10n ** 12n : 0n) : balance > budget ? balance - budget : 0n
  console.log(`\n[${id}] competent viem baseline: ${formatUsdc(amount18, { maxDecimals: 18 })} vs LastDollar ${formatUsdc(sdkQuote.lines[0].amount18, { maxDecimals: 18 })}`)
  if (!EXECUTE) return
  proofs.entries = proofs.entries.filter((e) => e.id !== id).concat({
    id,
    label: `Competent fee-aware baseline (${mode}) written with plain viem`,
    evidenceType: 'computation',
    mode,
    chainId: 5042,
    blockNumber: block.number,
    from: signer.address,
    baseline: { gasEstimate: gas, maxFeePerGas: maxFee, budget18: budget, amount18 },
    lastDollar: { gasLimit: sdkQuote.fee.gasLimit, maxFeePerGas: sdkQuote.fee.maxFeePerGas, budget18: sdkQuote.fee.maxFeeBudget18, amount18: sdkQuote.lines[0].amount18 },
    note: 'Both approaches are fee-aware and both produce a valid amount. They differ only in fee policy; LastDollar adds the bounded estimate loop, final simulation with exact caps, revalidation and receipt reconciliation.',
    recordedAt: new Date().toISOString(),
  })
  save()
}

console.log(`Payer ${acct.payer.address}; splitter ${config.splitter ?? 'NOT DEPLOYED'}; fee cap ${formatUsdc(FEE_CAP18)} USDC; already spent ${formatUsdc(spentFees())} USDC`)
const payerBal = await readArcBalance({ publicClient: primary, address: acct.payer.address, config })
console.log(`Payer balance ${formatUsdc(payerBal.native18, { maxDecimals: 18 })} USDC`)

const ctx = (signer) => ({ publicClient: primary, account: signer.address, config })

await runPayment('native-exact', 'Exact native payment, 0.010000 USDC', acct.payer, () =>
  quoteExactPayment({ ...ctx(acct.payer), recipient: acct.b.address, amount18: parseUsdc('0.01'), mode: 'native' }),
)
await runPayment('erc20-exact', 'Exact ERC-20 payment, 0.010000 USDC', acct.payer, () =>
  quoteExactPayment({ ...ctx(acct.payer), recipient: acct.b.address, amount18: parseUsdc('0.01'), mode: 'erc20' }),
)
if (config.splitter) {
  await runPayment('native-batch', 'Atomic native batch to three recipients via LastDollarSplitter', acct.payer, () =>
    quoteBatchPayment({
      ...ctx(acct.payer),
      payments: [
        { recipient: acct.b.address, amount18: parseUsdc('0.01') },
        { recipient: acct.c.address, amount18: parseUsdc('0.02') },
        { recipient: acct.d.address, amount18: parseUsdc('0.03') },
      ],
    }),
  )
} else {
  console.log('\n[native-batch] skipped: splitter not deployed (run pnpm deploy:splitter --execute)')
}

// Send-max proofs run from C (ERC-20) and D (native), which hold only what the batch delivered.
const cBal = await readArcBalance({ publicClient: primary, address: acct.c.address, config })
if (cBal.native18 > 0n) {
  const cMax = await quoteMaxPayment({ ...ctx(acct.c), recipient: acct.payer.address, mode: 'erc20' })
  if (cMax.fee) {
    await naiveBaseline('baseline-naive-erc20', 'Naive ERC-20 send-max: transfer(balanceOf()) under the same fee caps', acct.c, 'erc20', acct.payer.address, cMax)
    await competentBaseline('baseline-competent-erc20', acct.c, 'erc20', acct.payer.address, cMax)
  }
  await runPayment('erc20-max', 'ERC-20 send-max from wallet C', acct.c, () => quoteMaxPayment({ ...ctx(acct.c), recipient: acct.payer.address, mode: 'erc20' }))
}
const dBal = await readArcBalance({ publicClient: primary, address: acct.d.address, config })
if (dBal.native18 > 0n) {
  const dMax = await quoteMaxPayment({ ...ctx(acct.d), recipient: acct.payer.address, mode: 'native' })
  if (dMax.fee) {
    await naiveBaseline('baseline-naive-native', 'Naive native send-max: value = full balance under the same fee caps', acct.d, 'native', acct.payer.address, dMax)
    await competentBaseline('baseline-competent-native', acct.d, 'native', acct.payer.address, dMax)
  }
  await runPayment('native-max', 'Native send-max from wallet D', acct.d, () => quoteMaxPayment({ ...ctx(acct.d), recipient: acct.payer.address, mode: 'native' }))
}

console.log(`\nTotal fees spent by verified proofs: ${formatUsdc(spentFees())} USDC (cap ${formatUsdc(FEE_CAP18)}).`)
if (!EXECUTE) console.log('Plan only. Re-run with --execute to broadcast.')
