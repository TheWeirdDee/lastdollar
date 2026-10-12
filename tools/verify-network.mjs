// Re-runs the Arc mainnet validation gates and writes evidence/network-check.json.
// Usage: pnpm verify:network
import { join } from 'node:path'
import { createPublicClient, http, parseAbi } from 'viem'
import { arcMainnet, parseNextBaseFee, toViemChain, SCALE } from '@lastdollar/arc'
import { ROOT, writeJson } from './lib.mjs'

const RPCS = arcMainnet.rpcUrls
const SAMPLE_ACCOUNTS = [
  '0xcf81a5b4d6b205b6ba805b418388e388513ef9c2',
  '0xf5e2371c3c616db157da0d27d2091f027838761d',
  '0x341bb8851ff8fd9eae20ea083c2f779e646b8488',
]
const erc20 = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
])

const result = { checkedAt: new Date().toISOString(), rpcs: [], token: {}, balanceViews: [], restrictions: {}, passed: true, notes: [] }
const fail = (msg) => {
  result.passed = false
  result.notes.push(`FAIL: ${msg}`)
}

for (const url of RPCS) {
  const c = createPublicClient({ transport: http(url, { timeout: 15_000 }) })
  try {
    const [chainId, block] = await Promise.all([c.getChainId(), c.getBlock()])
    const ageSeconds = Math.round(Date.now() / 1000 - Number(block.timestamp))
    result.rpcs.push({ url, chainId, latestBlock: block.number, ageSeconds, baseFeePerGas: block.baseFeePerGas, nextBaseFeeFromExtraData: parseNextBaseFee(block.extraData) })
    if (chainId !== 5042) fail(`${url} chain ${chainId}`)
    if (ageSeconds > 120) fail(`${url} latest block is ${ageSeconds}s old`)
  } catch (e) {
    result.rpcs.push({ url, error: String(e.shortMessage ?? e.message) })
    result.notes.push(`WARN: ${url} unreachable`)
  }
}

const client = createPublicClient({ chain: toViemChain(arcMainnet), transport: http(RPCS[0]) })
const blockNumber = await client.getBlockNumber()
const [decimals, symbol, name, code] = await Promise.all([
  client.readContract({ address: arcMainnet.usdc, abi: erc20, functionName: 'decimals' }),
  client.readContract({ address: arcMainnet.usdc, abi: erc20, functionName: 'symbol' }),
  client.readContract({ address: arcMainnet.usdc, abi: erc20, functionName: 'name' }),
  client.getCode({ address: arcMainnet.usdc }),
])
result.token = { address: arcMainnet.usdc, decimals, symbol, name, hasCode: !!code && code !== '0x' }
if (decimals !== 6) fail(`USDC decimals ${decimals}`)

for (const address of SAMPLE_ACCOUNTS) {
  const [native18, token6] = await Promise.all([
    client.getBalance({ address, blockNumber }),
    client.readContract({ address: arcMainnet.usdc, abi: erc20, functionName: 'balanceOf', args: [address], blockNumber }),
  ])
  const ok = native18 / SCALE === token6
  result.balanceViews.push({ address, blockNumber, native18, token6, truncationHolds: ok, subMicro18: native18 % SCALE })
  if (!ok) fail(`balance views disagree for ${address}`)
}

try {
  await client.call({ account: SAMPLE_ACCOUNTS[0], to: '0x0000000000000000000000000000000000000000', value: 1n })
  result.restrictions.zeroAddressValueTransfer = 'succeeded (unexpected)'
  fail('value transfer to zero address did not revert')
} catch (e) {
  result.restrictions.zeroAddressValueTransfer = `reverted: ${e.details ?? e.shortMessage}`
}
result.restrictions.nativeTransferGasToEoa = await client.estimateGas({ account: SAMPLE_ACCOUNTS[0], to: SAMPLE_ACCOUNTS[1], value: 1n })

writeJson(join(ROOT, 'evidence', 'network-check.json'), result)
console.log(JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
if (!result.passed) process.exit(1)
