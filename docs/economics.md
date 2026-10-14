# Fee economics

What a payment costs on Arc, what LastDollar shows before you sign, and what has and has not been measured. All figures come from mainnet receipts in [evidence/mainnet/proofs.json](../evidence/mainnet/proofs.json) unless marked as computed.

## Four numbers, kept separate

| Shown before signing | Meaning |
|---|---|
| **Recipient receives** | Exactly what arrives. Native mode is exact to 18 decimals; ERC-20 to 6. |
| **Estimated network fee** | Expected gas × current fee price. What it will probably cost. |
| **Maximum fee budget** | Gas limit × maximum fee per gas. The most the signed transaction can be charged. |
| **Maximum total debit** | Recipient amount + maximum fee budget. Never more than this leaves the wallet. |

After inclusion, the receipt gives the **actual fee**, normally close to the estimate and never above the budget unless a wallet changed the caps (LastDollar flags that).

LastDollar charges no fee of its own. The only cost is Arc's network fee, paid in USDC from the same balance.

## Measured on mainnet

All at Arc's 20 gwei base-fee floor (priority tip 1,337 wei).

| Operation | Gas used | Actual fee (USDC) | Evidence |
|---|---|---|---|
| Native transfer | 21,000 | 0.00042 | `native-exact`, `native-max`, `browser-native-max` |
| ERC-20 `transfer` | 48,938 | 0.000979 | `erc20-exact`, `erc20-max` |
| Splitter batch, 2 recipients | 77,122 | 0.001542 | `browser-native-batch` |
| Splitter batch, 3 recipients | 114,909 | 0.002298 | `native-batch` |

### Batches: measured, estimated and calculated

Three kinds of figure appear below. Keep them apart:

- **Measured**: `gasUsed` from a mainnet receipt.
- **Estimated**: `eth_estimateGas` results. Nothing was sent.
- **Calculated**: arithmetic from a measured single transfer.

**Measured batches**

| Batch | Gas used | Recipient account state just before the batch |
|---|---|---|
| `native-batch`, 3 recipients | 114,909 | 1 funded (balance > 0, nonce 0); 2 empty (balance 0, nonce 0, no code) |
| `browser-native-batch`, 2 recipients | 77,122 | 1 funded (balance > 0, nonce 0); 1 empty |

**Gas estimates for this configuration—not executed benchmarks**

| Recipients | Batch, non-empty recipients | Batch, empty recipients | Separate native transfers (calculated, 21,000 each) |
|---|---|---|---|
| 1 | 44,316 | 69,457 | 21,000 |
| 2 | 57,257 | 106,700 | 42,000 |
| 3 | 70,196 | 144,719 | 63,000 |
| 4 | 83,137 | — | 84,000 |
| 5 | 96,078 | — | 105,000 |
| 6 | 108,177 | — | 126,000 |
| 8 | 134,008 | — | 168,000 |
| 10 | 159,838 | 407,980 | 210,000 |

In these estimates, batching used less gas from four recipients onward for the tested existing addresses. Here "existing" means non-empty accounts. That is a result for these accounts at this block, not a general break-even point.

How the estimates were made:

| | |
|---|---|
| Network | Arc mainnet, chain 5042, `https://rpc.mainnet.arc.io` |
| Block | 25910201 (2026-10-14 10:47:52 UTC, base fee 20 gwei); every call was estimated at this block |
| Procedure | `eth_estimateGas` for `LastDollarSplitter.pay(recipients, amounts)` at `0xFfF3427E2E3C9CEac64ebEb3F34e48485D434944` |
| Parameters | `from` `0xE306b8ae6e958F7C8e3401f1f12d550E5DAecab6`; each amount 1 wei; `value` = number of recipients in wei; no gas limit or fee fields, because gas used does not depend on the fee price |
| Non-empty recipients | 10 accounts taken from transaction senders in the preceding blocks, each confirmed at that block to have nonce > 0, balance > 0 and no code. A funded account with nonce 0 gave the same 1-recipient figure (44,316). |
| Empty recipients | Synthetic addresses, each confirmed at that block to have nonce 0, balance 0 and no code |
| Separate-transfer baseline | 21,000 × recipients, calculated. A top-level native transfer was also estimated at exactly 21,000 to both an empty and a non-empty account. |
| Not covered | Larger amounts add a little calldata gas (non-zero bytes cost more). Contract recipients, recipients repeated within a batch, recipient counts other than those listed, and other blocks were not tested. |

**What decides the extra cost.** On Arc, as in the EVM rule of EIP-161, a value transfer made from inside a contract to an *empty* account pays an extra 25,000 gas. Empty means nonce 0, balance 0 and no code. In these estimates each empty recipient added about 25,140 gas to a batch. A top-level native transfer to an empty account did not pay this (21,000). Whether an account has ever sent a transaction does not matter: a funded account with nonce 0 cost the same as an active one.

**Gas is not the whole cost.** The USDC fee is gas used × the effective gas price when each transaction is included. A batch pays one price. Separate transfers each pay the price at their own inclusion. Under different fee conditions, lower gas does not automatically mean a lower USDC cost. All the figures here are at Arc's 20 gwei base-fee floor.

What a batch also gives you, whatever the gas: one signature, and all-or-nothing execution. Either every recipient is paid or none is.

**Possible optimisations, not measured.** The splitter emits its own `Payout` event for each recipient, alongside the native transfer log that Arc emits anyway. It also checks the inputs in a separate loop before paying. Dropping the event or merging the loops might lower the per-recipient cost. Neither has been implemented or measured, and either would need a new contract deployment.

## Why send-max leaves something behind

The wallet must be able to pay the worst case it signs for, so send-max reserves the full fee budget. The network charges the actual fee, which is usually lower. The difference stays in the wallet.

| Run | Start | Sent | Actual fee | Budget | Left | What is left |
|---|---|---|---|---|---|---|
| `browser-native-max` (filmed in MetaMask) | 0.033 | 0.0323724999664413 | 0.000420000028077 | 0.0006275000335587 | 0.0002075000054817 | exactly the unused budget |
| `native-max` (SDK script) | 0.03 | 0.0293724999738709 | 0.000420000021861 | 0.0006275000261291 | 0.0002075000042681 | exactly the unused budget |
| `erc20-max` (SDK script) | 0.02 | 0.018593 | 0.000978760050944458 | 0.001406475058565619 | 0.000428239949055542 | unused budget 0.000427715007621161 plus 0.000000524941434381 from rounding the amount down to 6 decimals |

A wallet that sent its whole balance would have nothing left for the fee. On Arc, a signed native transfer of the full balance was rejected by the node before inclusion (`baseline-naive-native-broadcast`, no fee charged). A full-balance ERC-20 transfer was not broadcast, because if included it would revert and still charge gas; that outcome is not demonstrated on mainnet.

A careful developer can compute a fee-aware amount with plain viem too; the proof page shows that baseline. LastDollar's contribution is the whole lifecycle around the number: bounded estimation, a final simulation with the exact caps, a recheck before signing, and reconciliation afterwards.

## Not yet measured

These would need new evidence before any claim is made:

- A direct-wallet transfer and a LastDollar transfer of the same amount under the same fee conditions.
- Executed batches at larger recipient counts and to non-empty recipients (only 2 and 3, mostly to empty accounts, are measured; the rest are estimates).
- How often the pre-signing recheck catches a real change (stale fees, balance moved, wallet-modified parameters) outside tests.
- Time-to-complete and error rates with real users.
