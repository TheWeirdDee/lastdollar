# Arc Microgrants submission pack

Prepared for the user's review. Nothing has been submitted. Every claim below must still be true at submission time; items marked **[fill in]** need the user.

Program facts, rechecked on 2026-10-11 at <https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq>: 20 grants of 500 USDC; deadline **October 14, 2026, 23:59 ET** (October 15, 04:59 in Africa/Lagos); apply on DoraHacks (`dorahacks.io/hackathon/arc-microgrants`). Required: a live deployment working on Arc mainnet at submission time, a public repository, a short description of what it does and how it uses Arc, and a public builder profile (GitHub, X or Farcaster). Not accepted: mockups, decks, testnet-only builds, projects without Arc components, or work already funded by Circle or Arc.

## Links

| Item | Value |
|---|---|
| Live app | https://lastdollar.vercel.app |
| Mainnet proof | https://lastdollar.vercel.app/proof |
| Public repository | **[fill in after the user publishes the repository]** |
| Splitter contract | see `evidence/mainnet/splitter-deployment.json` |
| Builder profile | **[fill in: GitHub, X or Farcaster]** |

## Short description (about 50 words)

LastDollar is an open-source USDC payment tool for Arc. It quotes the recipient amount and the network fee together, rechecks conditions right before your wallet signs, and verifies settlement from the receipt. It supports exact payments, fee-aware send-max and atomic native batches, as a web app and a TypeScript SDK.

## Longer description

On Arc, USDC is both the payment asset and the gas token, and one balance appears as 18 decimals natively and 6 decimals through the ERC-20 interface. Applications that send a full token balance, or compare the two views directly, produce transfers that cannot pay for themselves and fee displays that are off by a factor of 10^12 ([arc-node #91](https://github.com/circlefin/arc-node/issues/91)).

LastDollar treats a payment as a complete lifecycle:

1. **Quote:** read both balance views at one block, estimate the exact call, and show the estimated fee separately from the maximum fee budget. For send-max, a bounded estimate-and-compute loop, then a final simulation with the exact fee caps.
2. **Recheck:** immediately before the wallet opens, re-read balance, nonce and fees and re-simulate. Changed terms go back to the user for review.
3. **Sign:** one signature in the user's own wallet. Non-custodial, no account, no backend.
4. **Verify:** reconcile transfer logs against what was reviewed, counting Arc's mirrored native and ERC-20 `Transfer` logs once, and compare the actual fee with the budget.

It ships as a web app (send, send-max, atomic batches with CSV import, receipts, local history, a public proof page) and as `@lastdollar/arc`, a viem-based SDK any Arc app can import. Batches use a roughly 60-line, ownerless splitter contract, so many recipients are paid in one native-USDC transaction with no token approval.

## Why Arc is essential

The product exists because of Arc's design: USDC as native gas, the dual 18/6-decimal views of one balance, the 20 gwei base-fee floor published in block `extraData`, EIP-7708 native transfer logs, and protocol rules such as the zero-address restriction and blocklist. Each is handled explicitly and documented with a live mainnet check in `docs/network-verification.md`.

## Evidence

**[fill in from evidence/mainnet/proofs.json after the proof run]**: one line per proof with operation, explorer link and actual fee. Expected set: native exact, ERC-20 exact, native batch, ERC-20 send-max, native send-max, plus simulated naive baselines and computed competent baselines.

Tests (local, labelled as such): 71 SDK unit and property tests, 8 SDK integration tests on a local chain, 22 contract tests including fuzzing and invariants, and 26 browser tests including responsive and accessibility checks.

## What we do not claim

No external audit; no zero fees; no guarantee that send-max empties a wallet; no complete wallet history; no third-party adoption yet; no grant award.

## Demo script (about 2 minutes)

1. Landing page: the problem in one sentence, then the review card ("Illustrative sample").
2. `/proof` without a wallet: network checks, then a mainnet send-max with intended and delivered amounts, estimated, maximum and actual fee, and **Re-verify live**.
3. Point to the naive baseline simulation failing with the same caps, and the competent viem baseline also working. The value is the lifecycle, not a secret formula.
4. `/app/send`: connect, enter a recipient, choose **Send maximum**, quote, review the remainder explanation, then cancel (or sign a tiny amount).
5. `/app/batch`: import a CSV with one bad row and show the row-level error. Fix it and quote: one transaction, no approval.
6. `/developers`: the quickstart, then `pnpm verify:evidence` in a terminal.

## Canteen Open Source Showcase

Eligibility is unresolved. The PRD mentions an earlier entry requirement that has not been verified. Check <https://arc-showcase.thecanteenapp.com/> before preparing a second submission; this pack does not assume eligibility.
