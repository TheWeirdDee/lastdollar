# Architecture

LastDollar is a browser app and a TypeScript SDK around one payment lifecycle: **quote → review → recheck → sign → reconcile**. The wallet holds the keys and signs. Everything else runs in the browser or reads public chain data.

## Components

```
                          ┌──────────────────────────────────────────────┐
                          │ Browser                                      │
  user ───────────────────┤                                              │
                          │  apps/web (Next.js 16, React 19)             │
                          │   ├─ /app/send, /app/batch                   │
                          │   │     quote · review · recheck · status    │
                          │   ├─ /app/history  (localStorage, per        │
                          │   │                 chain + account)         │
                          │   ├─ /app/transactions/[hash]  any receipt   │
                          │   └─ /proof  evidence + "Re-verify live"     │
                          │                │                             │
                          │                ▼                             │
                          │  packages/sdk  @lastdollar/arc (viem)        │
                          │   quote* → preparePayment → revalidatePlan   │
                          │        → executePayment → verifyPaymentReceipt│
                          │        │ reads                 │ sign request │
                          └────────┼───────────────────────┼─────────────┘
                                   │                       ▼
                                   │              Wallet (MetaMask, any
                                   │              EIP-6963 / injected)
                                   │              holds keys, signs, sends
                                   ▼                       │
              /api/rpc  read-only relay (Vercel)           │
              allow-listed read methods, 64 KB limit,      │
              send/sign methods refused (403)              │
                                   │                       │
                                   ▼                       ▼
                     ┌───────────────────────────────────────────┐
                     │ Arc mainnet (chain 5042)                  │
                     │  native USDC (18 dec, also the gas token) │
                     │  USDC ERC-20 view 0x3600… (6 dec)          │
                     │  LastDollarSplitter 0xFfF3…4944 (batches)  │
                     └───────────────────────────────────────────┘
```

The browser reads chain state through the same-origin relay and falls back to Arc's official RPC directly. Signed transactions never pass through the relay: the wallet broadcasts them.

## Repository map

| Path | What it is |
|---|---|
| `packages/sdk` | `@lastdollar/arc`: balances, fee context, exact / max / batch quotes, preparation, pre-signing revalidation, execution, receipt reconciliation, CSV parsing, typed errors. Peer dependency: `viem`. |
| `apps/web` | The site and app. Wallet connection (wagmi), send and batch flows, local history, receipt lookup, proof page, docs rendered from `docs/`. |
| `apps/web/src/app/api/rpc` | The read-only relay. The only server code. |
| `contracts` | `LastDollarSplitter.sol`: forwards native USDC to up to 200 recipients in one call and holds nothing. Foundry unit, fuzz and invariant tests. |
| `examples/node` | Exact, max, batch and receipt examples using the SDK outside the app. |
| `tools` | Network verification, splitter deployment, mainnet proof runner and recorder, evidence verifier, pack test. |
| `evidence` | Machine-readable mainnet evidence, network checks and test results. No secrets. |
| `video` | Remotion project for the demo video. |

## One payment, step by step

| Step | Where | What happens |
|---|---|---|
| Read | SDK | Native and ERC-20 balances at one block; base fee (Arc floors it at 20 gwei and publishes the next one); nonce and pending nonce. |
| Quote | SDK | Estimate the exact call. Gas limit = estimate + margin. Fee budget = gas limit × max fee per gas. Exact: check amount + budget fits. Max: bounded estimate-and-compute loop, then `eth_call` with the final caps. |
| Review | App | Recipient (full address), amount, estimated fee, maximum fee budget, maximum total debit, projected remaining. Any edit, account or chain change discards the quote. |
| Recheck | SDK (`revalidatePlan`) | Immediately before the wallet opens: balance, nonce, fees and simulation again. Changed economic terms → `STALE_QUOTE`, review again. |
| Sign | Wallet | One request with the reviewed gas limit, fee caps and nonce. LastDollar never switches networks or holds keys. |
| Track | App | Hash saved before waiting; one in-flight payment per tab; cross-tab lock per account; replacement and timeout handled. |
| Reconcile | SDK (`verifyPaymentReceipt`) | Read the receipt's EIP-7708 native logs, USDC logs and splitter `Payout` events; count an ERC-20 transfer's mirrored native log once; compare delivered amounts and actual fee with what was reviewed; report wallet-modified gas parameters. |

## Trust boundaries

| Component | Trusted for | Not trusted for |
|---|---|---|
| Wallet | Keys, showing and signing the request | Keeping the dapp's gas parameters (checked afterwards) |
| App and SDK | Preparing requests, explaining costs, reconciling receipts | Custody, signing, deciding to send |
| Arc RPC (and the relay) | Chain state and receipts | Honesty or availability: chain id is checked on every quote, failures fail closed, evidence is re-verified on a second provider |
| LastDollarSplitter | Forwarding exactly the authorised payouts in one call | Holding value (it holds none) |
| Browser storage | Convenience history | Settlement truth (status is re-read from chain) |

What LastDollar cannot prevent: a wallet rewriting gas parameters (it reports this), a user approving a request in the wallet that differs from the review, fee changes between signing and inclusion within the signed caps, or a compromised browser or extension. Full threat model: [security.md](security.md).

## Evidence pipeline

```
payment on mainnet ─► pnpm proof:record <id> <hash>
                        reconcile on rpc.mainnet.arc.io AND rpc.drpc.mainnet.arc.io
                        store only if both agree ─► evidence/mainnet/proofs.json
                                                         │
             pnpm verify:evidence (anyone, locally) ◄────┤
             /proof "Re-verify live" (any browser) ◄─────┘
```

Two providers agreeing shows the chain facts are consistent. It does not show which interface created a transaction; that is recorded separately as provenance. See [mainnet-proof.md](mainnet-proof.md).
