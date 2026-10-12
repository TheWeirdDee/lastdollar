# @lastdollar/arc

Arc-aware USDC payments for [viem](https://viem.sh): quote the full cost, recheck before signing, execute through the user's own wallet, and reconcile the receipt from chain data.

On Arc, USDC is both the payment asset and the gas token. The same balance is visible as an 18-decimal native balance and through a 6-decimal ERC-20 interface at `0x3600…0000`. This package handles that model so a payment can be quoted and verified without unit mistakes.

```sh
npm install @lastdollar/arc viem
```

## Quick start

```ts
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { arc } from 'viem/chains'
import { quoteExactPayment, preparePayment, executePayment, parseUsdc, formatUsdc } from '@lastdollar/arc'

const publicClient = createPublicClient({ chain: arc, transport: http() })
const walletClient = createWalletClient({ chain: arc, transport: custom(window.ethereum!) })
const [account] = await walletClient.requestAddresses()

const quote = await quoteExactPayment({
  publicClient,
  account,
  recipient: '0x…',
  amount18: parseUsdc('25.00'),
  mode: 'erc20', // or 'native'
})

if (quote.status !== 'ready') throw new Error(quote.blockers.map((b) => b.message).join(' '))
console.log(`Recipient gets ${formatUsdc(quote.recipientTotal18)} USDC`)
console.log(`Estimated fee ${formatUsdc(quote.fee!.estimatedFee18)}, at most ${formatUsdc(quote.fee!.maxFeeBudget18)}`)

// After the user has reviewed the quote:
const result = await executePayment({ walletClient: walletClient.extend(() => ({ account })) as never, publicClient, plan: preparePayment(quote) })
console.log(result.receipt.status) // 'verified' | 'mismatch' | 'reverted'
```

## API

| Function | Purpose |
|---|---|
| `readArcBalance` | Native and ERC-20 views of one USDC holding, read at the same block |
| `quoteExactPayment` | Deliver an exact amount (native or ERC-20) |
| `quoteMaxPayment` | Largest amount after reserving a bounded fee budget |
| `quoteBatchPayment` | Atomic native batch through the LastDollarSplitter contract |
| `preparePayment` | Freeze a ready quote into the exact request to sign |
| `revalidatePlan` | Recheck chain state before signing; reports changed terms |
| `executePayment` | Revalidate, request one signature, wait, reconcile |
| `verifyPaymentReceipt` | Reconcile any transaction hash from chain data |

Units are explicit: `*18` values are native 18-decimal units, `*6` values are ERC-20 units. All math is `bigint`.

Errors are `LastDollarError` instances with a stable `code` such as `INSUFFICIENT_GAS_FUNDS`, `STALE_QUOTE`, `USER_REJECTED`, `WRONG_CHAIN` or `RECONCILIATION_INCOMPLETE`.

## Guarantees and limits

- Quotes are conditional on chain state. `executePayment` revalidates and throws `STALE_QUOTE` instead of signing changed terms.
- `maxFeeBudget18` is a cap (`gasLimit × maxFeePerGas`), not a fee prediction. Send-max leaves the unused part of the budget behind, plus any sub-micro-USDC balance in ERC-20 mode.
- The SDK never holds keys, never switches networks, and never signs without the caller invoking `executePayment`.
- Smart-contract wallets and wallets that rewrite gas parameters are supported only to the extent that the receipt is reconciled; a rewritten fee cap is reported, not prevented.

Full documentation, the math reference and mainnet evidence: see the repository's `docs/` directory.

MIT licensed.
