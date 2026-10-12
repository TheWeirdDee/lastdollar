// Records an already-broadcast LastDollarSplitter deployment as public evidence.
// Verifies the runtime bytecode against the local build on two RPC providers.
// Usage: pnpm deploy:record <txHash> [--also <otherTxHash>]   (--also records a duplicate deployment as unused)
import { keccak256 } from 'viem'
import { arcMainnet } from '@lastdollar/arc'
import { DEPLOYMENT_FILE, PRIMARY_RPC, SECONDARY_RPC, assertMainnet, clientFor, splitterArtifact, writeJson } from './lib.mjs'

const hash = process.argv[2]
const alsoIdx = process.argv.indexOf('--also')
const also = alsoIdx > 0 ? process.argv[alsoIdx + 1] : undefined
const art = splitterArtifact()
const meta = typeof art.metadata === 'string' ? JSON.parse(art.metadata) : art.metadata
const primary = clientFor(PRIMARY_RPC)
const secondary = clientFor(SECONDARY_RPC)
await assertMainnet(primary, 'primary RPC')
await assertMainnet(secondary, 'verification RPC')

async function inspect(h) {
  const receipt = await primary.getTransactionReceipt({ hash: h })
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`${h}: not a successful contract creation`)
  const [c1, c2] = await Promise.all([
    primary.getCode({ address: receipt.contractAddress }),
    secondary.getCode({ address: receipt.contractAddress, blockNumber: receipt.blockNumber }),
  ])
  return { receipt, primaryHash: keccak256(c1), secondaryHash: keccak256(c2) }
}

const main = await inspect(hash)
const record = {
  network: { name: 'Arc', chainId: 5042 },
  address: main.receipt.contractAddress,
  deployer: main.receipt.from,
  signer: 'browser wallet (MetaMask)',
  transactionHash: hash,
  blockNumber: main.receipt.blockNumber,
  gasUsed: main.receipt.gasUsed,
  effectiveGasPrice: main.receipt.effectiveGasPrice,
  fee18: main.receipt.gasUsed * main.receipt.effectiveGasPrice,
  compiler: meta.compiler.version,
  settings: { optimizer: meta.settings.optimizer, evmVersion: meta.settings.evmVersion, metadata: meta.settings.metadata },
  source: 'contracts/src/LastDollarSplitter.sol',
  localRuntimeKeccak: art.runtimeHash,
  onchainRuntimeKeccak: main.primaryHash,
  runtimeMatches: main.primaryHash === art.runtimeHash,
  independentRpcRuntimeMatches: main.secondaryHash === art.runtimeHash,
  explorer: `${arcMainnet.explorerUrl}/address/${main.receipt.contractAddress}`,
  explorerVerification: 'pending',
  recordedAt: new Date().toISOString(),
}
if (also) {
  const dup = await inspect(also)
  record.unusedDuplicate = {
    note: 'An identical second deployment was broadcast by mistake during wallet signing. It is not used by the app.',
    address: dup.receipt.contractAddress,
    transactionHash: also,
    blockNumber: dup.receipt.blockNumber,
    fee18: dup.receipt.gasUsed * dup.receipt.effectiveGasPrice,
    runtimeMatches: dup.primaryHash === art.runtimeHash,
  }
}
writeJson(DEPLOYMENT_FILE, record)
console.log(JSON.stringify(record, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
if (!record.runtimeMatches || !record.independentRpcRuntimeMatches) process.exit(1)
