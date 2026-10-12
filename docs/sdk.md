# SDK guide

`@lastdollar/arc` is a TypeScript library for preparing, executing and verifying USDC payments on Arc with [viem](https://viem.sh). It has no React, server or account dependency. Its only peer dependency is `viem ^2.30`.

## Install

Registry publication is pending. Until then, build the package from the repository:

```sh
git clone https://github.com/TheWeirdDee/lastdollar && cd lastdollar
pnpm install && pnpm sdk:build
cd packages/sdk && npm pack            # produces lastdollar-arc-0.1.0.tgz
# in your project:
npm install /path/to/lastdollar-arc-0.1.0.tgz viem
```

`pnpm test:pack` proves the packed tarball installs into a fresh project and works from ESM, CommonJS and TypeScript.

## Configure

```ts
import { createPublicClient, http } from 'viem'
import { arc } from 'viem/chains'
import { arcMainnet, defineArcNetwork } from '@lastdollar/arc'

const publicClient = createPublicClient({ chain: arc, transport: http() })

// Defaults are Arc mainnet. Add the splitter address to enable batches.
const config = defineArcNetwork(arcMainnet, { splitter: '0x…' })
```

`ArcNetworkConfig` holds the chain id, RPC URLs, explorer, USDC address, the EIP-7708 native transfer emitter, the 20 gwei minimum base fee and the optional splitter. Every quote checks `eth_chainId` against `config.chainId` and throws `WRONG_CHAIN` on a mismatch.

## Lifecycle

```
quote*  →  preparePayment  →  (user reviews)  →  executePayment  →  receipt
                                   ↑                   │
                                   └── STALE_QUOTE ────┘   (revalidatePlan found changed terms)
```

### 1. Quote

```ts
import { quoteExactPayment, quoteMaxPayment, quoteBatchPayment, parseUsdc } from '@lastdollar/arc'

const exact = await quoteExactPayment({ publicClient, account, recipient, amount18: parseUsdc('12.50'), mode: 'erc20', config })
const max = await quoteMaxPayment({ publicClient, account, recipient, mode: 'native', config })
const batch = await quoteBatchPayment({ publicClient, account, config, payments: [{ recipient: a, amount18: parseUsdc('1') }, { recipient: b, amount18: parseUsdc('2') }] })
```

A `PaymentQuote` contains:

| Field | Meaning |
|---|---|
| `status` | `'ready'` or `'blocked'` |
| `blockers`, `warnings` | `{ code, message }` lists; blockers prevent execution |
| `lines` | Recipients and amounts (18-decimal). For `max`, the computed amount |
| `tokenAmount6` | ERC-20 mode: the exact `transfer` amount |
| `balance` | Native and ERC-20 views at the snapshot block, sub-micro remainder, consistency flag |
| `fee` | `gasEstimate`, `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, `estimatedFee18`, `maxFeeBudget18` |
| `maxDebit18`, `estimatedRemaining18`, `minimumRemaining18` | Projections for display |
| `request` | The exact EIP-1559 request that will be signed |
| `simulation` | `'passed'`, `'failed'` or `'skipped'` (final `eth_call` with exact caps) |
| `nonce`, `pendingNonce`, `createdAt`, `expiresAt`, `id` | State context and a fingerprint of the terms |

Input errors (invalid address, zero address, zero amount, excess precision, invalid batch) are thrown as `LastDollarError` before any RPC call. Chain-state problems (insufficient funds, failed simulation, a pending transaction) come back as a `blocked` quote so they can be shown with full context.

### 2. Prepare

```ts
const plan = preparePayment(quote) // pure; throws if the quote is blocked
```

### 3. Recheck

`executePayment` calls this for you. You can also call it directly, for example to refresh a review screen:

```ts
const check = await revalidatePlan({ publicClient, plan, config })
if (check.status !== 'valid') showChanges(check.changes, check.fresh)
```

### 4. Execute

```ts
const result = await executePayment({
  walletClient,              // a viem WalletClient whose account is the quoted payer
  publicClient,
  plan,
  config,
  onBroadcast: (hash) => persist(hash), // save before waiting
  onUpdate: ({ status, hash }) => render(status),
})
result.receipt.status // 'verified' | 'mismatch' | 'reverted'
```

`executePayment`:

1. Checks the wallet account equals the quoted payer (`ACCOUNT_MISMATCH`) and the wallet chain equals the config (`WRONG_CHAIN`). It never switches networks.
2. Revalidates. Changed terms throw `STALE_QUOTE` with `details.fresh` and `details.changes`. Nothing is signed.
3. Sends exactly the reviewed request: gas limit, fee caps and nonce included.
4. Waits for the receipt. A wallet speed-up (`repriced`) is followed; a cancellation or unrelated replacement throws `TRANSACTION_REPLACED`. A timeout throws `RECEIPT_TIMEOUT` carrying the hash. That outcome is unknown, not failed.
5. Reconciles the receipt against the plan.

### 5. Verify any receipt

```ts
const r = await verifyPaymentReceipt({ publicClient, hash, config, expected: plan /* optional */ })
```

| Status | Meaning |
|---|---|
| `verified` | Succeeded and every expected payout matched exactly |
| `mismatch` | Succeeded but observed transfers, operation, sender or request differ |
| `reverted` | Included and reverted; no value moved, the fee was charged |
| `pending` | Known transaction, no receipt yet |
| `not-found` | Unknown to this RPC |
| `observed` | Succeeded; no expectation supplied |

Reconciliation reads Arc's EIP-7708 native `Transfer` logs, the USDC token's own logs, and the splitter's `Payout` events. It counts the mirrored native log of an ERC-20 transfer once (`mirroredNativeLogs`), cross-checks every splitter payout against a native log, and compares the broadcast gas and fee caps with the reviewed request (`comparison.walletModifiedParameters`).

## Native and ERC-20 modes

| | Native | ERC-20 |
|---|---|---|
| Call | value transfer to the recipient | `USDC.transfer(recipient, T6)` |
| Precision | 18 decimals | 6 decimals; finer input rejected |
| Typical gas | 21,000 | ≈ 49,000–74,000 |
| Contract recipients | Must accept native value | Standard token semantics |
| Send-max remainder | Unused fee budget | Unused budget plus sub-micro dust |

## Units and helpers

`parseUsdc('1.25')` returns 18-decimal units and rejects more than 6 decimals. `parseNativeUsdc` allows 18. `formatUsdc(x18, { maxDecimals })` truncates and never displays a non-zero fee as zero. `toNative18`, `toToken6Floor`, `subMicroRemainder`, `maxNativeAmount18`, `maxTokenAmount6`, `checkExactAffordability`, `feeBudget18` and `applyGasMargin` are pure and exported for reuse. See [payment-math.md](payment-math.md).

## CSV batches

```ts
const csv = parseBatchCsv(text) // header: recipient,amount[,reference]
if (!csv.ok) report(csv.errors, csv.rows.filter((r) => r.errors.length))
else await quoteBatchPayment({ publicClient, account, payments: csv.lines, config })
```

The parser is strict: it requires the header, handles quoted fields and CRLF, rejects excess precision, the zero address and extra columns, and never rounds, merges or drops a row. `BATCH_CSV_TEMPLATE` is a valid example.

## Error codes

All failures are `LastDollarError` with a stable `code`:

`INVALID_RECIPIENT`, `UNSUPPORTED_RECIPIENT`, `INVALID_AMOUNT`, `INVALID_PRECISION`, `INVALID_BATCH`, `WRONG_CHAIN`, `ACCOUNT_MISMATCH`, `INSUFFICIENT_FUNDS`, `INSUFFICIENT_GAS_FUNDS`, `NOTHING_TO_SEND`, `STALE_QUOTE`, `QUOTE_EXPIRED`, `USER_REJECTED`, `SIMULATION_FAILED`, `RPC_UNAVAILABLE`, `BROADCAST_FAILED`, `EXECUTION_REVERTED`, `TRANSACTION_REPLACED`, `RECEIPT_TIMEOUT`, `RECONCILIATION_INCOMPLETE`, `VERIFICATION_MISMATCH`, `SPLITTER_UNAVAILABLE`, `DUPLICATE_SUBMISSION`, `UNKNOWN`.

`classifyError(err)` maps viem, wallet (EIP-1193 `4001`) and RPC errors, including Arc's `revert: OutOfFunds` and `Zero address not allowed`, onto these codes. Unknown errors stay `UNKNOWN`.

## Wallet compatibility

- Works with any viem `WalletClient` that has an account: browser wallets (EIP-1193), local accounts, and JSON-RPC accounts.
- Wallets may rewrite gas limits or fee caps. The SDK cannot prevent that; it reports it in `comparison.modifiedFields`, and the budget comparison uses the reviewed cap.
- Wallets that ignore a dapp-supplied nonce are compatible; a different nonce is reported.
- Smart-contract accounts (EIP-4337 bundlers, EIP-5792 `sendCalls`) are not supported in this version.

## Duplicate submission

The SDK sends exactly one transaction per `executePayment` call and never retries a broadcast. Application-level guards (one in-flight plan, a cross-tab lock, persisting the hash in `onBroadcast`, blocking quotes while a nonce is pending) live in the web app. Neither is an on-chain idempotency guarantee.

## Examples

`examples/node` contains `exact-transfer.mjs`, `max-transfer.mjs`, `batch-payout.mjs` and `verify-receipt.mjs`. They quote read-only by default and only sign with `--execute` and a `PRIVATE_KEY` environment variable.
