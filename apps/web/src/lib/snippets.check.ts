// Type-checked mirror of the code shown in src/lib/snippets.ts. Never imported at runtime.
// If the SDK API changes, `pnpm typecheck` fails here before the site shows stale examples.
import { createPublicClient, createWalletClient, custom, http, type Address, type Hash, type EIP1193Provider } from 'viem'
import { arc } from 'viem/chains'
import {
  executePayment,
  formatUsdc,
  parseBatchCsv,
  parseUsdc,
  preparePayment,
  quoteBatchPayment,
  quoteExactPayment,
  quoteMaxPayment,
  verifyPaymentReceipt,
  type ArcNetworkConfig,
} from '@lastdollar/arc'

declare const ethereum: EIP1193Provider

export async function quickstart() {
  const publicClient = createPublicClient({ chain: arc, transport: http() })
  const [account] = await createWalletClient({ chain: arc, transport: custom(ethereum) }).requestAddresses()
  if (!account) return
  const walletClient = createWalletClient({ account, chain: arc, transport: custom(ethereum) })
  const quote = await quoteExactPayment({
    publicClient,
    account,
    recipient: '0x2401f72D90E19daD3d0c3e45b906C760507791E8',
    amount18: parseUsdc('25.00'),
    mode: 'erc20',
  })
  if (quote.status !== 'ready') throw new Error(quote.blockers[0]?.message)
  console.log(formatUsdc(quote.maxDebit18), 'USDC at most')
  const { receipt } = await executePayment({ walletClient, publicClient, plan: preparePayment(quote) })
  console.log(receipt.status, formatUsdc(receipt.actualFee18 ?? 0n))
}

export async function others(account: Address, recipient: Address, fileText: string, hash: Hash, config: ArcNetworkConfig) {
  const publicClient = createPublicClient({ chain: arc, transport: http() })
  const quote = await quoteMaxPayment({ publicClient, account, recipient, mode: 'native' })
  console.log(formatUsdc(quote.recipientTotal18, { maxDecimals: 18 }))
  const csv = parseBatchCsv(fileText)
  if (!csv.ok) throw new Error('Fix the highlighted rows first')
  const batch = await quoteBatchPayment({ publicClient, account, payments: csv.lines, config })
  const plan = preparePayment(batch)
  const result = await verifyPaymentReceipt({ publicClient, hash, expected: plan })
  console.log(result.status, result.delivered, result.actualFee18)
}
