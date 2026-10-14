# Fix status

Ledger for the external audit findings (LD-001 to LD-022), updated 2026-10-14 after the re-audit of `f1efdc7`. "Fixed" means the code and its checks changed in this repository. "Not wallet-verified" means no new funded browser-wallet run exercised the path afterwards.

| ID | Status | What changed / how it is checked |
| --- | --- | --- |
| LD-001 | Fixed | `revalidatePlan` checks the reviewed recipient total plus the retained fee budget in both modes; SDK regression tests cover it. |
| LD-002 | Fixed, not wallet-verified | Any draft edit, account change or chain change invalidates the quote; late quote results are discarded. |
| LD-003 | Fixed, not wallet-verified | Review shows full recipient addresses and exact amounts. |
| LD-004 | Fixed | Native input accepts 18 decimals; ERC-20 input 6. |
| LD-005 | Fixed, not wallet-verified | The result card warns when the fee exceeded the reviewed maximum. History recovery now compares the actual fee with the reviewed budget (pre-signing snapshot, else quoted budget) and marks an over-budget payment as a mismatch with the overage shown. |
| LD-006 | Fixed | `proof:record` derives mode and kind from the decoded operation, records the reviewed quote as not recorded, stores the broadcast caps separately as `submitted`, compares the fee with the submitted cap, and labels `--intended` as asserted after execution. The three existing browser entries were migrated to this format. |
| LD-007 | Fixed | `verify:evidence` checks operation, status, block, fee and payouts; the public Re-verify button now applies the same status, operation, block and issues checks. |
| LD-008 | Fixed | Proof page labels each entry's provenance; the methodology distinguishes the five scripted proofs from the three owner-reported browser payments. |
| LD-009 | Fixed | Payment math, submission demo and methodology describe accepted `eth_call` baselines and the one free node rejection accurately. |
| LD-010 | Fixed | Residual panel shows unused budget plus the additive token-rounding remainder. |
| LD-011 | Fixed | SDK README documents the source build and packed tarball; registry publication is not claimed. |
| LD-012 | Fixed | Node engine `>=22.13` matches pnpm 11.5; CI runs Node 22. |
| LD-013 | Fixed | CI on `main` is green including browser tests. |
| LD-014 | Fixed, not wallet-verified | CSV references are validated live; each import has a generation guard and invalidates the quote again when rows change; editing or removing a row clears its stale import message. |
| LD-015 | Fixed | Relay rejects null, primitives and malformed batches without forwarding. |
| LD-016 | Fixed | Settled history records are re-read when History opens. A not-found, pending or failed check keeps the last confirmed status but labels it as uncorroborated; failed checks are retried on the next visit. |
| LD-017 | Fixed | Privacy page discloses review snapshots, their 30-day expiry and their removal with history; repository contact link corrected. |
| LD-018 | Fixed | Wallet dialog restores focus to its trigger; missing-provider errors show guidance instead of library text. |
| LD-019 | Fixed | Proof page shows the build commit; the test summary records the tested commit; `.vercelignore` no longer hides the summary from deployments. |
| LD-020 | Fixed | Clearing history also removes the account's review snapshots; snapshots older than 30 days are pruned. |
| LD-021 | Fixed | Relay enforces the 64 KB limit in UTF-8 bytes (declared `Content-Length` and actual body). A 23,068-character, 69,068-byte request returns 413. |
| LD-022 | Fixed | `verify:evidence` fails when the local splitter build differs from the deployed runtime or cannot be read. Tested: corrupted artifact exits 1, real artifact exits 0. |

Not performed in this pass: a new funded browser-wallet payment, an external security review, or explorer source verification (the explorer API blocks scripted clients; see `docs/deployment.md`).
