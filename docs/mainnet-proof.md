# Mainnet proof methodology

The proof page shows only transactions that exist on Arc mainnet and reconcile cleanly. This document explains how they are produced and how anyone can re-check them.

## What was run (2026-10-12)

`tools/run-mainnet-proof.mjs` executed every step through the same SDK functions the web app uses (`quote*` → `preparePayment` → `executePayment` → `verifyPaymentReceipt`). The payer was the user's own funded Account 1 (`0xE306…cab6`), signing locally from a key file outside the repository. Account 2 (`0x97f3…dE8d`) belongs to the user; C and D are small wallets generated for the send-max proofs, which returned their funds to Account 1.

| Id | Operation | From → to | Amount | Result |
|---|---|---|---|---|
| `native-exact` | Exact native payment | Account 1 → Account 2 | 0.010000 | verified |
| `erc20-exact` | Exact ERC-20 payment | Account 1 → Account 2 | 0.010000 | verified |
| `native-batch` | Atomic batch through LastDollarSplitter | Account 1 → Account 2, C, D | 0.01, 0.02, 0.03 | verified |
| `baseline-naive-erc20` | Simulation: `transfer(balanceOf())` from C under the same caps | — | full token view | **accepted by `eth_call`** |
| `baseline-competent-erc20` | Computation: fee-aware max with plain viem | — | 0.018027 vs LastDollar 0.018593 | both valid |
| `erc20-max` | ERC-20 send-max | C → Account 1 | 0.018593 | verified |
| `baseline-naive-native` | Simulation: value = full balance from D under the same caps | — | full balance | **accepted by `eth_call`** |
| `baseline-competent-native` | Computation: plain viem equivalent | — | 0.02916 vs LastDollar 0.02937 | both valid |
| `native-max` | Native send-max | D → Account 1 | 0.0293724999738709 | verified |
| `baseline-naive-native-broadcast` | Signed naive full-balance native send, submitted | D → Account 1 | full balance | **rejected by the node before inclusion, no fee** |

Total network fees for the five proofs: 0.005095 USDC. The splitter deployment (signed in MetaMask through `pnpm deploy:browser`) cost 0.0094 USDC; an identical duplicate deployment was broadcast by mistake (0.0087 USDC) and is recorded as unused.

### Later payments made in the live app (owner-reported)

| Id | Operation | From → to | Amount | Actual fee | Result |
|---|---|---|---|---|---|
| `browser-native-exact` | Native transfer | Account 1 → Account 2 | 0.001 | 0.00042 | verified |
| `browser-erc20-exact` | ERC-20 transfer | Account 1 → Account 2 | 0.001 | 0.000978760050944458 | verified |
| `browser-native-batch` | Splitter batch | Account 1 → Account 2, Account 3 | 0.001 each | 0.001542440080284002 | verified |

These were recorded after the fact with `pnpm proof:record`. Their payouts, fees, blocks and operations are chain facts checked on two RPC providers. Their reviewed quotes were not exported before signing, so the evidence stores only the caps in the broadcast transaction and labels the reviewed quote as not recorded.

### What the baselines showed

- On Arc, `eth_call` with the final gas limit and fee caps **accepted** naive full-balance transfers. Simulation alone therefore does not demonstrate the naive failure, and the evidence does not claim it does.
- A real signed naive native send was rejected by the node with `insufficient funds for gas * price + value`, before inclusion, at no cost.
- A naive ERC-20 full-balance transfer was not broadcast: if it were included it would revert and still charge gas. That outcome is therefore not demonstrated on mainnet.
- A competent fee-aware approach with plain viem also produces a valid amount. LastDollar's value is the complete lifecycle (bounded estimate loop, exact-cap simulation, pre-signing recheck, reconciliation), not a unique formula.

## Safeguards

- Both RPCs must report chain 5042 before anything runs.
- A fee cap (default 0.05 USDC, `LASTDOLLAR_FEE_CAP`) stops the run before the summed maximum fee budgets would exceed it.
- Each step is resumable: verified steps are skipped on re-run.
- A step that does not reconcile as `verified`, or whose independent check disagrees, stops the run.
- Naive baselines are first dry-run with `eth_call`, and the outcome is recorded as-is (on Arc both were accepted). One naive native send was then signed and submitted; the node rejected it before inclusion, so nothing was included and no fee was charged. A naive transfer that would be included and revert (charging gas) is never broadcast.
- Private keys live outside the repository (`~/.lastdollar/proof-wallets.env`) and are never printed or written to evidence.

## What is recorded

`evidence/mainnet/proofs.json`. Integer strings are base units (`*18` native, `*6` ERC-20). Each mainnet entry includes:

- chain id, transaction hash, block number and timestamp, sender, destination, splitter address for batches
- intended and delivered payouts
- the quote: snapshot block, balances, gas estimate and limit, fee caps, estimated fee, maximum fee budget, maximum debit, send-max iterations, fee policy
- actual gas used, effective gas price, actual fee, whether it stayed within budget, whether the signer changed parameters, mirrored native logs not double counted
- sender balance before and after, including the sub-micro remainder after send-max
- reconciliation result and issues
- independent verification: second RPC URL, its status, whether both agree, and the time
- SDK version

`evidence/mainnet/splitter-deployment.json` records the deployer, address, deployment transaction, block, gas, compiler and settings, local and on-chain runtime bytecode hashes from two RPCs, and explorer verification status.

## Re-checking

```sh
pnpm verify:evidence                         # both default RPCs
pnpm verify:evidence --rpc https://rpc.quicknode.mainnet.arc.io
```

The verifier re-reads each transaction and receipt, re-runs reconciliation, and requires the delivered payouts, actual fee and block to match the record, and the delivered payouts to equal the intended ones. It also compares the splitter's on-chain runtime bytecode with the record and the local build. Any difference exits non-zero.

The proof page's **Re-verify live** button performs the same reconciliation from the visitor's browser.

## Limits

- The five scripted proofs (`native-exact`, `erc20-exact`, `native-batch`, `erc20-max`, `native-max`) were signed by a local key through the SDK. The three `browser-*` entries were reported by the owner as payments made in the live app with MetaMask; a receipt cannot prove which interface created it, so the proof page labels their execution channel unknown and records their reviewed quote as not recorded. The splitter deployment was signed in MetaMask.
- Two RPC providers are operated independently, but both read the same chain. They guard against a faulty or dishonest endpoint, not against the chain itself.
- Value moved between the user's own accounts and helper wallets, so this shows that the mechanics work, not that anyone has adopted the tool.
