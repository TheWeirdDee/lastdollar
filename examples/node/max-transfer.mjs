// Send-max: the largest payment after reserving a bounded fee budget.
//   node max-transfer.mjs --from 0xPayer --to 0xRecipient --mode native
import { executePayment, formatUsdc, preparePayment, quoteMaxPayment } from '@lastdollar/arc'
import { arg, config, execute, payer, publicClient, walletFor } from './shared.mjs'

const account = payer()
const quote = await quoteMaxPayment({ publicClient, config, account: account.address, recipient: arg('to'), mode: arg('mode', 'erc20') })

console.log(`Status:               ${quote.status} (${quote.iterations} estimate round(s))`)
console.log(`Balance:              ${formatUsdc(quote.balance.native18, { maxDecimals: 18 })} USDC`)
console.log(`Maximum sendable:     ${formatUsdc(quote.recipientTotal18, { maxDecimals: 18 })} USDC`)
console.log(`Fee budget reserved:  ${formatUsdc(quote.fee?.maxFeeBudget18 ?? 0n)} USDC`)
console.log(`Expected to remain:   ${formatUsdc(quote.estimatedRemaining18, { maxDecimals: 18 })} USDC`)
for (const b of quote.blockers) console.log(`Blocked: ${b.code} ${b.message}`)

if (execute && quote.status === 'ready') {
  const result = await executePayment({ walletClient: walletFor(account), publicClient, config, plan: preparePayment(quote) })
  console.log(`Receipt ${result.finalHash}: ${result.receipt.status}`)
}
