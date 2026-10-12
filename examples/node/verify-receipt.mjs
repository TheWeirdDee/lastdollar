// Reconcile any Arc transaction from chain data.
//   node verify-receipt.mjs --hash 0x…
import { formatUsdc, verifyPaymentReceipt } from '@lastdollar/arc'
import { arg, config, publicClient } from './shared.mjs'

const r = await verifyPaymentReceipt({ publicClient, config, hash: arg('hash') })
console.log(`Status:     ${r.status}`)
console.log(`Operation:  ${r.operation}`)
if (r.actualFee18 !== undefined) console.log(`Actual fee: ${formatUsdc(r.actualFee18)} USDC (${r.gasUsed} gas)`)
for (const d of r.delivered) console.log(`Delivered:  ${d.recipient} ${formatUsdc(d.amount18, { maxDecimals: 18 })} USDC`)
if (r.mirroredNativeLogs) console.log(`(${r.mirroredNativeLogs} native mirror log(s) not double counted)`)
for (const i of r.issues) console.log(`Issue:      ${i}`)
