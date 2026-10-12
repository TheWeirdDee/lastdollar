/**
 * Integration tests against a local anvil chain (chain id 5042, 20 gwei base fee).
 *
 * What this covers: real signing, broadcast, receipts, revalidation, stale quotes, rejection and
 * the splitter's atomic payouts with the SDK's actual code paths.
 * What it cannot cover: anvil does not implement Arc's native-USDC precompile or EIP-7708
 * native Transfer logs, so ERC-20 execution and log-based verification are covered by
 * real mainnet evidence instead. These tests assert that reconciliation refuses to mark a
 * payment verified when Arc's native transfer logs are missing.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  parseEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  arcMainnet,
  defineArcNetwork,
  executePayment,
  isLastDollarError,
  preparePayment,
  quoteBatchPayment,
  quoteExactPayment,
  quoteMaxPayment,
  toViemChain,
  type ArcNetworkConfig,
} from '../../src/index.js'

const PORT = 8546
const RPC = `http://127.0.0.1:${PORT}`
const ROOT = resolve(__dirname, '../../../..')
const FOUNDRY_BIN = join(homedir(), '.foundry', 'bin')
const foundry = (n: string) => {
  const local = join(FOUNDRY_BIN, process.platform === 'win32' ? `${n}.exe` : n)
  return existsSync(local) ? local : n // CI installs Foundry on PATH
}
// Anvil's well-known deterministic development keys. Never used outside a local test chain.
const PAYER_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const OTHER_KEY: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const BOB: Address = getAddress('0x00000000000000000000000000000000000b0b00')
const CAROL: Address = getAddress('0x00000000000000000000000000000000000ca401')

let anvil: ChildProcess
let config: ArcNetworkConfig
let publicClient: PublicClient
let wallet: WalletClient
const payer = privateKeyToAccount(PAYER_KEY)
const other = privateKeyToAccount(OTHER_KEY)

function artifact(name: string) {
  const json = JSON.parse(readFileSync(join(ROOT, 'contracts', 'out', `${name}.sol`, `${name}.json`), 'utf8'))
  return { bytecode: json.bytecode.object as Hex, deployed: json.deployedBytecode.object as Hex }
}

async function waitForRpc() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' })
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('anvil did not start')
}

beforeAll(async () => {
  execFileSync(foundry('forge'), ['build'], { cwd: join(ROOT, 'contracts'), stdio: 'ignore' })
  anvil = spawn(foundry('anvil'), [
    '--port', String(PORT), '--chain-id', '5042', '--base-fee', '20000000000', '--silent',
  ])
  await waitForRpc()
  const testClient = createTestClient({ mode: 'anvil', transport: http(RPC) })
  await testClient.setCode({ address: arcMainnet.usdc, bytecode: artifact('MockArcUsdcView').deployed })

  const local = defineArcNetwork(arcMainnet, { rpcUrls: [RPC], isMainnet: false, name: 'Local anvil (Arc chain id)' })
  const chain = toViemChain(local)
  publicClient = createPublicClient({ chain, transport: http(RPC) }) as PublicClient
  wallet = createWalletClient({ account: payer, chain, transport: http(RPC) })
  const hash = await wallet.deployContract({ abi: [], bytecode: artifact('LastDollarSplitter').bytecode, account: payer, chain })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  config = defineArcNetwork(local, { splitter: receipt.contractAddress! })
  // Give the payer a balance with sub-micro dust, like real Arc accounts.
  await testClient.setBalance({ address: payer.address, value: parseEther('3') + 123_456_789n })
}, 120_000)

afterAll(() => {
  anvil?.kill()
})

describe('native payments on a local chain', () => {
  it('executes an exact native payment end to end', async () => {
    const amount = parseEther('0.25')
    const before = await publicClient.getBalance({ address: BOB })
    const quote = await quoteExactPayment({ publicClient, account: payer.address, recipient: BOB, amount18: amount, mode: 'native', config })
    expect(quote.status).toBe('ready')
    const plan = preparePayment(quote)
    const updates: string[] = []
    const result = await executePayment({ walletClient: wallet, publicClient, plan, config, onUpdate: (u) => updates.push(u.status) })
    expect(updates).toEqual(['revalidating', 'awaiting-signature', 'submitted', 'confirming', 'reconciling', 'mismatch'])
    expect((await publicClient.getBalance({ address: BOB })) - before).toBe(amount)
    expect(result.receipt.actualFee18).toBe(result.receipt.gasUsed! * result.receipt.effectiveGasPrice!)
    expect(result.receipt.comparison?.feeWithinBudget).toBe(true)
    expect(result.receipt.comparison?.walletModifiedParameters).toBe(false)
    // Anvil has no EIP-7708 logs, so the SDK must not claim verification.
    expect(result.receipt.status).toBe('mismatch')
    expect(result.receipt.issues.join()).toMatch(/No native transfer log/)
  })

  it('send-max leaves only the unused fee budget behind', async () => {
    const quote = await quoteMaxPayment({ publicClient, account: payer.address, recipient: BOB, mode: 'native', config })
    expect(quote.status).toBe('ready')
    const plan = preparePayment(quote)
    const result = await executePayment({ walletClient: wallet, publicClient, plan, config })
    const left = await publicClient.getBalance({ address: payer.address })
    expect(left).toBe(quote.fee!.maxFeeBudget18 - result.receipt.actualFee18!)
    expect(left).toBeGreaterThan(0n)
    // Refund the payer for later tests.
    await createTestClient({ mode: 'anvil', transport: http(RPC) }).setBalance({ address: payer.address, value: parseEther('3') })
  })

  it('pays a batch atomically through the splitter in one transaction', async () => {
    const lines = [
      { recipient: BOB, amount18: parseEther('0.1') },
      { recipient: CAROL, amount18: 1n }, // sub-micro-USDC payout is preserved exactly
      { recipient: BOB, amount18: parseEther('0.2') },
    ]
    const bob0 = await publicClient.getBalance({ address: BOB })
    const carol0 = await publicClient.getBalance({ address: CAROL })
    const quote = await quoteBatchPayment({ publicClient, account: payer.address, payments: lines, config })
    expect(quote.status).toBe('ready')
    expect(quote.warnings.some((w) => w.code === 'DUPLICATE_RECIPIENT')).toBe(true)
    const result = await executePayment({ walletClient: wallet, publicClient, plan: preparePayment(quote), config })
    expect((await publicClient.getBalance({ address: BOB })) - bob0).toBe(parseEther('0.3'))
    expect((await publicClient.getBalance({ address: CAROL })) - carol0).toBe(1n)
    expect(result.receipt.operation).toBe('splitter-batch')
    expect(result.receipt.delivered).toEqual(lines.map(({ recipient, amount18 }) => ({ recipient, amount18 })))
    expect(await publicClient.getBalance({ address: config.splitter! })).toBe(0n)
  })
})

describe('safety checks before signing', () => {
  it('throws STALE_QUOTE and sends nothing when the balance changed after review', async () => {
    const plan = preparePayment(await quoteMaxPayment({ publicClient, account: payer.address, recipient: CAROL, mode: 'native', config }))
    const otherWallet = createWalletClient({ account: other, chain: toViemChain(config), transport: http(RPC) })
    await publicClient.waitForTransactionReceipt({ hash: await otherWallet.sendTransaction({ to: payer.address, value: parseEther('1') }) })
    const nonce = await publicClient.getTransactionCount({ address: payer.address })
    await expect(executePayment({ walletClient: wallet, publicClient, plan, config })).rejects.toSatisfy(
      (e: unknown) => isLastDollarError(e, 'STALE_QUOTE') && Array.isArray((e as unknown as { details: { changes: unknown[] } }).details.changes),
    )
    expect(await publicClient.getTransactionCount({ address: payer.address })).toBe(nonce)
  })

  it('reports wallet rejection and sends nothing', async () => {
    const plan = preparePayment(await quoteExactPayment({ publicClient, account: payer.address, recipient: BOB, amount18: 1_000_000_000_000n, mode: 'native', config }))
    const rejecting = createWalletClient({
      account: payer.address,
      chain: toViemChain(config),
      transport: custom({
        async request({ method }) {
          if (method === 'eth_chainId') return '0x13b2'
          throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
        },
      }),
    })
    await expect(executePayment({ walletClient: rejecting, publicClient, plan, config })).rejects.toMatchObject({ code: 'USER_REJECTED' })
  })

  it('refuses a wallet on another chain without switching it', async () => {
    const plan = preparePayment(await quoteExactPayment({ publicClient, account: payer.address, recipient: BOB, amount18: 1_000_000_000_000n, mode: 'native', config }))
    const wrongChain = createWalletClient({
      account: payer.address,
      transport: custom({
        async request({ method }) {
          if (method === 'eth_chainId') return '0x1'
          throw new Error(`unexpected ${method}`)
        },
      }),
    })
    await expect(executePayment({ walletClient: wrongChain, publicClient, plan, config })).rejects.toMatchObject({ code: 'WRONG_CHAIN' })
  })

  it('refuses a wallet whose account is not the quoted payer', async () => {
    const plan = preparePayment(await quoteExactPayment({ publicClient, account: payer.address, recipient: BOB, amount18: 1_000_000_000_000n, mode: 'native', config }))
    const otherWallet = createWalletClient({ account: other, chain: toViemChain(config), transport: http(RPC) })
    await expect(executePayment({ walletClient: otherWallet, publicClient, plan, config })).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' })
  })

  it('a reverting batch recipient blocks the quote before signing', async () => {
    const testClient = createTestClient({ mode: 'anvil', transport: http(RPC) })
    const reverter: Address = '0x000000000000000000000000000000000000dEaD'
    await testClient.setCode({ address: reverter, bytecode: '0x60006000fd' }) // always reverts
    const quote = await quoteBatchPayment({
      publicClient,
      account: payer.address,
      config,
      payments: [
        { recipient: BOB, amount18: 1n },
        { recipient: reverter, amount18: 1n },
      ],
    })
    expect(quote.status).toBe('blocked')
    expect(quote.blockers[0]?.code).toBe('SIMULATION_FAILED')
  })
})
