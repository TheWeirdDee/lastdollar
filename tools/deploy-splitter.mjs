// Deploys LastDollarSplitter to Arc mainnet from the local proof payer wallet.
// Usage: pnpm deploy:splitter            (dry run: estimate and print the cost)
//        pnpm deploy:splitter --execute  (broadcast; requires a funded payer)
import { createWalletClient, http, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcMainnet, formatUsdc, toViemChain } from '@lastdollar/arc'
import { DEPLOYMENT_FILE, PRIMARY_RPC, SECONDARY_RPC, assertMainnet, clientFor, loadWallets, readJson, splitterArtifact, writeJson } from './lib.mjs'

const execute = process.argv.includes('--execute')
const existing = readJson(DEPLOYMENT_FILE)
if (existing?.address && !process.argv.includes('--force')) {
  console.log(`Already deployed at ${existing.address} (tx ${existing.transactionHash}). Use --force to deploy again.`)
  process.exit(0)
}

const wallets = loadWallets()
const account = privateKeyToAccount(wallets.PAYER_PRIVATE_KEY)
const primary = clientFor(PRIMARY_RPC)
const secondary = clientFor(SECONDARY_RPC)
await assertMainnet(primary, 'primary RPC')
await assertMainnet(secondary, 'verification RPC')

const art = splitterArtifact()
const [gas, block, balance] = await Promise.all([
  primary.estimateGas({ account: account.address, data: art.bytecode }),
  primary.getBlock(),
  primary.getBalance({ address: account.address }),
])
const maxFeePerGas = (block.baseFeePerGas * 125n) / 100n
const gasLimit = (gas * 12n) / 10n
const budget = gasLimit * maxFeePerGas
console.log(`Deployer ${account.address} on chain 5042`)
console.log(`Estimated gas ${gas}, limit ${gasLimit}, maxFeePerGas ${maxFeePerGas}`)
console.log(`Expected cost ${formatUsdc(gas * block.baseFeePerGas)} USDC, maximum ${formatUsdc(budget)} USDC; balance ${formatUsdc(balance)} USDC`)
if (!execute) {
  console.log('Dry run only. Re-run with --execute to deploy.')
  process.exit(0)
}
if (balance < budget) throw new Error('Deployer balance is below the maximum deployment budget.')

const wallet = createWalletClient({ account, chain: toViemChain(arcMainnet), transport: http(PRIMARY_RPC) })
const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, gas: gasLimit, maxFeePerGas, maxPriorityFeePerGas: 0n })
console.log(`Broadcast ${hash}`)
const receipt = await primary.waitForTransactionReceipt({ hash, timeout: 120_000 })
if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`Deployment failed: ${receipt.status}`)
const [code1, code2] = await Promise.all([
  primary.getCode({ address: receipt.contractAddress }),
  secondary.getCode({ address: receipt.contractAddress, blockNumber: receipt.blockNumber }),
])
const meta = typeof art.metadata === 'string' ? JSON.parse(art.metadata) : art.metadata
const record = {
  network: { name: 'Arc', chainId: 5042 },
  address: receipt.contractAddress,
  deployer: account.address,
  transactionHash: hash,
  blockNumber: receipt.blockNumber,
  gasUsed: receipt.gasUsed,
  effectiveGasPrice: receipt.effectiveGasPrice,
  fee18: receipt.gasUsed * receipt.effectiveGasPrice,
  compiler: meta.compiler.version,
  settings: { optimizer: meta.settings.optimizer, evmVersion: meta.settings.evmVersion, metadata: meta.settings.metadata },
  source: 'contracts/src/LastDollarSplitter.sol',
  localRuntimeKeccak: art.runtimeHash,
  onchainRuntimeKeccak: keccak256(code1),
  runtimeMatches: keccak256(code1) === art.runtimeHash,
  independentRpcRuntimeMatches: keccak256(code2) === art.runtimeHash,
  explorer: `${arcMainnet.explorerUrl}/address/${receipt.contractAddress}`,
  explorerVerification: 'pending',
  deployedAt: new Date().toISOString(),
}
writeJson(DEPLOYMENT_FILE, record)
console.log(JSON.stringify(record, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
if (!record.runtimeMatches) throw new Error('On-chain runtime bytecode does not match the local build.')
