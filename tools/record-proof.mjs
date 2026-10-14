// Records an already-broadcast mainnet payment as public evidence. Reconciles the hash on two RPC
// providers and writes it to evidence/mainnet/proofs.json.
//
// Usage: pnpm proof:record <id> <hash> "<label>" [--intended 0xRecipient=0.01,...]
//
// Only what the chain shows is recorded as fact. Mode and kind come from the decoded operation, not
// the id. The reviewed quote is not known after the fact, so it is recorded as unavailable and the
// fee is compared with the submitted cap instead. --intended is labelled as asserted at recording
// time, after execution.
import { SDK_VERSION, parseUsdc, readArcBalance, verifyPaymentReceipt } from '@lastdollar/arc'
import { getAddress, isHash } from 'viem'
import { PRIMARY_RPC, PROOFS_FILE, SECONDARY_RPC, assertMainnet, clientFor, networkConfig, readJson, writeJson } from './lib.mjs'

const [id, hash, label = id] = process.argv.slice(2)
if (!id || !hash || !isHash(hash)) {
  console.error('Usage: pnpm proof:record <id> <hash> "<label>" [--intended 0xAddr=amount,...]')
  process.exit(1)
}
const i = process.argv.indexOf('--intended')
const intended =
  i > 0
    ? process.argv[i + 1].split(',').map((pair) => {
        const [addr, amount] = pair.split('=')
        return { recipient: getAddress(addr), amount18: parseUsdc(amount) }
      })
    : undefined

const config = networkConfig()
const primary = clientFor(PRIMARY_RPC, config)
const secondary = clientFor(SECONDARY_RPC, config)
await assertMainnet(primary, 'primary RPC')
await assertMainnet(secondary, 'verification RPC')

const a = await verifyPaymentReceipt({ publicClient: primary, hash, config })
const b = await verifyPaymentReceipt({ publicClient: secondary, hash, config })
const str = (x) => JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
const lines = (r) => r.delivered.map((d) => ({ recipient: d.recipient, amount18: d.amount18 }))
// Both providers must report the same chain facts, not just the same payouts and fee.
const facts = (r) => str({ status: r.status, operation: r.operation, block: r.blockNumber, fee: r.actualFee18, from: r.from, to: r.to, lines: lines(r), issues: r.issues })
const agree = facts(a) === facts(b)

const issues = [...new Set([...a.issues, ...b.issues])]
if (!agree) issues.push('Primary and independent RPC providers reported different chain facts')
if (a.status !== 'observed') issues.push(`Receipt status ${a.status}`)
if (intended && str(intended) !== str(lines(a))) issues.push('Delivered payouts differ from the intended payouts')
if (a.operation === 'unknown') issues.push('Transaction is not a recognised USDC payment')
const ok = issues.length === 0 && agree
const tx = await primary.getTransaction({ hash })
const after = await readArcBalance({ publicClient: primary, address: a.from, config, blockNumber: a.blockNumber })
const before = await readArcBalance({ publicClient: primary, address: a.from, config, blockNumber: a.blockNumber - 1n })

const proofs = readJson(PROOFS_FILE, { schema: 1, entries: [] })
const entry = {
  id,
  label,
  evidenceType: 'mainnet',
  // A hash and receipt cannot prove which UI or wallet produced it.  Callers
  // may add owner-attested provenance outside this recorder; unknown stays unknown.
  provenance: { channel: 'unknown', source: 'chain receipt and caller-supplied hash', reviewedEvidence: 'unavailable unless exported before signing' },
  // A receipt cannot distinguish exact from send-max; only batches are identifiable.
  kind: a.operation === 'splitter-batch' ? 'batch' : 'exact',
  mode: a.operation === 'erc20-transfer' ? 'erc20' : 'native',
  chainId: 5042,
  hash,
  blockNumber: a.blockNumber,
  blockTimestamp: a.blockTimestamp,
  from: a.from,
  to: a.to,
  splitter: a.viaSplitter ? config.splitter : undefined,
  intended: intended ?? lines(a),
  intendedSource: intended ? 'asserted at recording time, after execution' : 'observed (no prior statement)',
  delivered: lines(a),
  submitted: { gasLimit: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas, maxFeeBudget18: tx.gas * (tx.maxFeePerGas ?? 0n) },
  quote: null,
  reviewedQuote: 'not recorded: no pre-signing review was exported for this hash',
  actual: {
    gasUsed: a.gasUsed,
    effectiveGasPrice: a.effectiveGasPrice,
    fee18: a.actualFee18,
    feeWithinSubmittedCap: a.actualFee18 <= tx.gas * (tx.maxFeePerGas ?? 0n),
    mirroredNativeLogs: a.mirroredNativeLogs,
  },
  sender: { before18: before.native18, beforeToken6: before.token6, after18: after.native18, afterToken6: after.token6, afterSubMicro18: after.subMicro18 },
  result: ok ? 'verified' : 'mismatch',
  operation: a.operation,
  issues,
  verification: { primaryRpc: PRIMARY_RPC, independentRpc: SECONDARY_RPC, independentStatus: b.status, rpcsAgree: agree, verifiedAt: new Date().toISOString() },
  sdkVersion: SDK_VERSION,
}
proofs.entries = proofs.entries.filter((e) => e.id !== id).concat(entry)
writeJson(PROOFS_FILE, proofs)
console.log(`${id}: ${entry.result}; ${a.operation}; fee ${a.actualFee18} wei; payouts ${str(lines(a))}; RPCs agree: ${agree}`)
if (!ok) {
  console.log(`Issues: ${issues.join('; ')}`)
  process.exit(1)
}
