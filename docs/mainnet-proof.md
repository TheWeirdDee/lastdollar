# Mainnet proof methodology

The proof page shows only transactions that exist on Arc mainnet and reconcile cleanly. This document explains how they are produced and how anyone can re-check them.

## Plan

`tools/run-mainnet-proof.mjs` runs these steps through the same SDK functions the web app uses (`quote*` → `preparePayment` → `executePayment` → `verifyPaymentReceipt`):

| Id | Operation | From → to | Amount |
|---|---|---|---|
| `native-exact` | Exact native payment | payer → B | 0.010000 USDC |
| `erc20-exact` | Exact ERC-20 payment | payer → B | 0.010000 USDC |
| `native-batch` | Atomic batch through LastDollarSplitter | payer → B, C, D | 0.01, 0.02, 0.03 USDC |
| `baseline-naive-erc20` | **Simulation:** `transfer(balanceOf())` from C with the same caps LastDollar quoted | — | full token view |
| `baseline-competent-erc20` | **Computation:** fee-aware max written with plain viem | — | — |
| `erc20-max` | ERC-20 send-max | C → payer | computed |
| `baseline-naive-native` | **Simulation:** value = full balance from D with the same caps | — | full balance |
| `baseline-competent-native` | **Computation:** plain viem equivalent | — | — |
| `native-max` | Native send-max | D → payer | computed |

Wallets B, C and D were generated for the proof, so transferred value stays recoverable; only network fees are spent. The send-max proofs run from C and D, which hold only what the batch delivered, which exercises realistic small balances.

## Safeguards

- Both RPCs must report chain 5042 before anything runs.
- A fee cap (default 0.05 USDC, `LASTDOLLAR_FEE_CAP`) stops the run before the summed maximum fee budgets would exceed it.
- Each step is resumable: verified steps are skipped on re-run.
- A step that does not reconcile as `verified`, or whose independent check disagrees, stops the run.
- Failing baselines are simulated with `eth_call`, never broadcast. If a naive baseline succeeds in simulation, that result is recorded as-is.
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

- Proof transactions are signed by local keys through the SDK, not by a browser wallet extension. The browser path is covered by end-to-end tests against a local chain.
- Two RPC providers are operated independently, but both read the same chain. They guard against a faulty or dishonest endpoint, not against the chain itself.
- Value moved between wallets controlled for the proof, so this shows that the mechanics work, not that anyone has adopted the tool.
