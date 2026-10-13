// Independently re-verifies every public mainnet evidence entry from chain data.
// Usage: pnpm verify:evidence [--rpc https://...]
// Exit code 0 only if every recorded mainnet claim still matches the chain.
import { keccak256 } from 'viem'
import { formatUsdc, verifyPaymentReceipt } from '@lastdollar/arc'
import { DEPLOYMENT_FILE, PROOFS_FILE, PRIMARY_RPC, SECONDARY_RPC, assertMainnet, clientFor, networkConfig, readJson, splitterArtifact } from './lib.mjs'

const rpcArg = process.argv.indexOf('--rpc')
const rpcs = rpcArg > 0 ? [process.argv[rpcArg + 1]] : [PRIMARY_RPC, SECONDARY_RPC]
const config = networkConfig()
const proofs = readJson(PROOFS_FILE)
const deployment = readJson(DEPLOYMENT_FILE)
let failures = 0

/** Public RPCs occasionally rate-limit; retry transient read failures before reporting them. */
async function withRetry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= attempts || err?.code !== 'RPC_UNAVAILABLE') throw err
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

for (const url of rpcs) {
  const client = clientFor(url, config)
  await assertMainnet(client, url)
  console.log(`\nVerifying against ${url}`)

  if (deployment?.address) {
    const code = await client.getCode({ address: deployment.address })
    const onchain = code ? keccak256(code) : 'none'
    let local = 'unavailable (run forge build)'
    try {
      local = splitterArtifact().runtimeHash
    } catch {
      /* contracts not built locally */
    }
    console.log(`  splitter ${deployment.address}: runtime ${onchain === deployment.onchainRuntimeKeccak ? 'matches record' : 'DIFFERS'}; local build ${local === onchain ? 'matches' : local}`)
    if (onchain !== deployment.onchainRuntimeKeccak) fail('splitter runtime differs from the deployment record')
  }

  for (const e of proofs?.entries ?? []) {
    if (e.evidenceType !== 'mainnet') continue
    let r
    try {
      r = await withRetry(() => verifyPaymentReceipt({ publicClient: client, hash: e.hash, config }))
    } catch (err) {
      fail(`${e.id} could not be read from ${url}: ${err.code ?? ''} ${err.message}`)
      continue
    }
    const delivered = r.delivered.map((d) => ({ recipient: d.recipient, amount18: d.amount18.toString() }))
    const expectedOperation = e.kind === 'batch' ? 'splitter-batch' : e.mode === 'erc20' ? 'erc20-transfer' : 'native-transfer'
    const ok =
      r.status === 'observed' &&
      r.operation === expectedOperation &&
      (!e.operation || e.operation === r.operation) &&
      r.actualFee18?.toString() === e.actual.fee18 &&
      JSON.stringify(delivered) === JSON.stringify(e.delivered) &&
      JSON.stringify(e.delivered) === JSON.stringify(e.intended) &&
      r.blockNumber?.toString() === e.blockNumber
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${e.id} ${e.hash} fee ${formatUsdc(r.actualFee18 ?? 0n)} USDC, ${delivered.length} payout(s)`)
    if (!ok) fail(`${e.id} does not match chain data (expected ${expectedOperation}, observed ${r.operation})`)
  }
}

const mainnetCount = (proofs?.entries ?? []).filter((e) => e.evidenceType === 'mainnet').length
console.log(`\n${mainnetCount} mainnet entr${mainnetCount === 1 ? 'y' : 'ies'} checked on ${rpcs.length} RPC(s); ${failures} failure(s).`)
if (mainnetCount === 0) console.log('No mainnet evidence recorded yet.')
process.exit(failures ? 1 : 0)
