/**
 * Code shown on the site. Each snippet is also compiled by `pnpm typecheck` through
 * src/lib/snippets.check.ts, so the marketing and docs examples cannot drift from the SDK.
 */
export const quickstartSnippet = `import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { arc } from 'viem/chains'
import {
  quoteExactPayment,
  preparePayment,
  executePayment,
  parseUsdc,
  formatUsdc,
} from '@lastdollar/arc'

const publicClient = createPublicClient({ chain: arc, transport: http() })
const [account] = await createWalletClient({ chain: arc, transport: custom(window.ethereum!) }).requestAddresses()
const walletClient = createWalletClient({ account, chain: arc, transport: custom(window.ethereum!) })

// 1. Quote: recipient amount, estimated fee and maximum fee budget, together.
const quote = await quoteExactPayment({
  publicClient,
  account,
  recipient: '0x2401f72D90E19daD3d0c3e45b906C760507791E8',
  amount18: parseUsdc('25.00'),
  mode: 'erc20',
})
if (quote.status !== 'ready') throw new Error(quote.blockers[0]?.message)
console.log(formatUsdc(quote.maxDebit18), 'USDC at most')

// 2-4. After the user reviews: recheck, sign once, then reconcile the receipt.
const { receipt } = await executePayment({ walletClient, publicClient, plan: preparePayment(quote) })
console.log(receipt.status, formatUsdc(receipt.actualFee18 ?? 0n))`

export const maxSnippet = `import { quoteMaxPayment, formatUsdc } from '@lastdollar/arc'

const quote = await quoteMaxPayment({ publicClient, account, recipient, mode: 'native' })
// amount + fee budget = balance, exactly; unused budget stays in the wallet.
console.log(formatUsdc(quote.recipientTotal18, { maxDecimals: 18 }))`

export const batchSnippet = `import { parseBatchCsv, quoteBatchPayment } from '@lastdollar/arc'

const csv = parseBatchCsv(fileText) // strict: row-level errors, never rounds
if (!csv.ok) throw new Error('Fix the highlighted rows first')
const quote = await quoteBatchPayment({ publicClient, account, payments: csv.lines, config })`

export const receiptSnippet = `import { verifyPaymentReceipt } from '@lastdollar/arc'

const result = await verifyPaymentReceipt({ publicClient, hash, expected: plan })
// 'verified' | 'mismatch' | 'reverted' | 'pending' | 'not-found' | 'observed'
console.log(result.status, result.delivered, result.actualFee18)`
