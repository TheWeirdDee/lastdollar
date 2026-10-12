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
    const r = await verifyPaymentReceipt({ publicClient: client, hash: e.hash, config })
    const delivered = r.delivered.map((d) => ({ recipient: d.recipient, amount18: d.amount18.toString() }))
    const ok =
      r.status === 'observed' &&
      r.actualFee18?.toString() === e.actual.fee18 &&
      JSON.stringify(delivered) === JSON.stringify(e.delivered) &&
      JSON.stringify(e.delivered) === JSON.stringify(e.intended) &&
      r.blockNumber?.toString() === e.blockNumber
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${e.id} ${e.hash} fee ${formatUsdc(r.actualFee18 ?? 0n)} USDC, ${delivered.length} payout(s)`)
    if (!ok) fail(`${e.id} does not match chain data`)
  }
}

const mainnetCount = (proofs?.entries ?? []).filter((e) => e.evidenceType === 'mainnet').length
console.log(`\n${mainnetCount} mainnet entr${mainnetCount === 1 ? 'y' : 'ies'} checked on ${rpcs.length} RPC(s); ${failures} failure(s).`)
if (mainnetCount === 0) console.log('No mainnet evidence recorded yet.')
process.exit(failures ? 1 : 0)
