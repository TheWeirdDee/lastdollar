// Records a mainnet payment made through the live app (browser wallet) as public evidence.
// Reconciles the hash on two RPC providers and writes it to evidence/mainnet/proofs.json.
//
// Usage: pnpm proof:record <id> <hash> "<label>" [--intended 0xRecipient=0.01,...]
//   id: native-exact | erc20-exact | native-batch | erc20-max | native-max
// Without --intended, the delivered payouts are recorded as observed (the quote is not known).
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
const agree = a.status === b.status && a.actualFee18 === b.actualFee18 && str(lines(a)) === str(lines(b))

const issues = [...a.issues]
if (a.status !== 'observed') issues.push(`Receipt status ${a.status}`)
if (intended && str(intended) !== str(lines(a))) issues.push('Delivered payouts differ from the intended payouts')
const ok = issues.length === 0 && agree
const tx = await primary.getTransaction({ hash })
const after = await readArcBalance({ publicClient: primary, address: a.from, config, blockNumber: a.blockNumber })
const before = await readArcBalance({ publicClient: primary, address: a.from, config, blockNumber: a.blockNumber - 1n })

const proofs = readJson(PROOFS_FILE, { schema: 1, entries: [] })
const entry = {
  id,
  label,
  evidenceType: 'mainnet',
  signer: 'browser wallet (MetaMask) via the live app',
  kind: id.includes('batch') ? 'batch' : id.includes('max') ? 'max' : 'exact',
  mode: id.startsWith('erc20') ? 'erc20' : 'native',
  chainId: 5042,
  hash,
  blockNumber: a.blockNumber,
  blockTimestamp: a.blockTimestamp,
  from: a.from,
  to: a.to,
  splitter: a.viaSplitter ? config.splitter : undefined,
  intended: intended ?? lines(a),
  intendedSource: intended ? 'stated before signing' : 'observed (no prior statement)',
  delivered: lines(a),
  submitted: { gasLimit: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas },
  quote: { gasLimit: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxFeeBudget18: tx.gas * (tx.maxFeePerGas ?? 0n), estimatedFee18: undefined },
  actual: {
    gasUsed: a.gasUsed,
    effectiveGasPrice: a.effectiveGasPrice,
    fee18: a.actualFee18,
    feeWithinBudget: a.actualFee18 <= tx.gas * (tx.maxFeePerGas ?? 0n),
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
