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

### Batches are about atomicity, not lower fees

| 3 recipients | Gas | Source |
|---|---|---|
| One splitter batch | 114,909 | measured |
| Three native transfers | 63,000 | computed: 3 × measured 21,000 |
| Three ERC-20 transfers | 146,814 | computed: 3 × measured 48,938 |

A splitter batch costs **more** gas than separate native transfers and less than separate ERC-20 transfers. What it adds is one signature and all-or-nothing execution: either every recipient is paid or none is. The three-transfer figures are computed from single measured transfers, not from a measured three-transaction run.

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
- Splitter batches at larger recipient counts (only 2 and 3 are measured).
- How often the pre-signing recheck catches a real change (stale fees, balance moved, wallet-modified parameters) outside tests.
- Time-to-complete and error rates with real users.
