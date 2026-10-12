// Atomic native batch through LastDollarSplitter: one transaction, no token approval.
//   SPLITTER_ADDRESS=0x… node batch-payout.mjs --from 0xPayer --csv payouts.csv
import { readFileSync } from 'node:fs'
import { executePayment, formatUsdc, parseBatchCsv, preparePayment, quoteBatchPayment } from '@lastdollar/arc'
import { arg, config, execute, payer, publicClient, walletFor } from './shared.mjs'

const parsed = parseBatchCsv(readFileSync(arg('csv', 'payouts.example.csv'), 'utf8'))
if (!parsed.ok) {
  for (const e of parsed.errors) console.log(`File: ${e}`)
  for (const r of parsed.rows) for (const e of r.errors) console.log(`Line ${r.line}: ${e}`)
  process.exit(1)
}

const account = payer()
const quote = await quoteBatchPayment({ publicClient, config, account: account.address, payments: parsed.lines })
console.log(`Status: ${quote.status}`)
quote.lines.forEach((l, i) => console.log(`  ${i + 1}. ${l.recipient}  ${formatUsdc(l.amount18)} USDC`))
console.log(`Total ${formatUsdc(quote.recipientTotal18)} USDC; max fee ${formatUsdc(quote.fee?.maxFeeBudget18 ?? 0n)} USDC`)
for (const w of quote.warnings) console.log(`Note: ${w.message}`)
for (const b of quote.blockers) console.log(`Blocked: ${b.code} ${b.message}`)

if (execute && quote.status === 'ready') {
  const result = await executePayment({ walletClient: walletFor(account), publicClient, config, plan: preparePayment(quote) })
  console.log(`Receipt ${result.finalHash}: ${result.receipt.status}`)
  result.receipt.delivered.forEach((d, i) => console.log(`  delivered ${i + 1}: ${d.recipient} ${formatUsdc(d.amount18)} USDC`))
}
