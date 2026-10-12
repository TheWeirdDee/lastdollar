// Exact payment: quote, review, then (optionally) execute and reconcile.
//   node exact-transfer.mjs --from 0xPayer --to 0xRecipient --amount 1.25 --mode erc20
//   PRIVATE_KEY=0x… node exact-transfer.mjs --to 0xRecipient --amount 1.25 --execute
import { executePayment, formatUsdc, isLastDollarError, parseUsdc, preparePayment, quoteExactPayment } from '@lastdollar/arc'
import { arg, config, execute, payer, publicClient, walletFor } from './shared.mjs'

const account = payer()
const quote = await quoteExactPayment({
  publicClient,
  config,
  account: account.address,
  recipient: arg('to'),
  amount18: parseUsdc(arg('amount', '0.01')),
  mode: arg('mode', 'erc20'),
})

console.log(`Status:            ${quote.status}`)
console.log(`Recipient gets:    ${formatUsdc(quote.recipientTotal18)} USDC`)
console.log(`Estimated fee:     ${formatUsdc(quote.fee?.estimatedFee18 ?? 0n)} USDC`)
console.log(`Maximum fee:       ${formatUsdc(quote.fee?.maxFeeBudget18 ?? 0n)} USDC`)
console.log(`Maximum debit:     ${formatUsdc(quote.maxDebit18)} USDC`)
console.log(`Remaining (est.):  ${formatUsdc(quote.estimatedRemaining18)} USDC`)
for (const b of quote.blockers) console.log(`Blocked: ${b.code} ${b.message}`)
for (const w of quote.warnings) console.log(`Note: ${w.message}`)

if (execute && quote.status === 'ready') {
  try {
    const result = await executePayment({ walletClient: walletFor(account), publicClient, config, plan: preparePayment(quote), onUpdate: (u) => console.log(`… ${u.status}`) })
    console.log(`Receipt ${result.finalHash}: ${result.receipt.status}, actual fee ${formatUsdc(result.receipt.actualFee18)} USDC`)
  } catch (err) {
    if (isLastDollarError(err, 'STALE_QUOTE')) console.log('Conditions changed; quote again and review.')
    else throw err
  }
}
