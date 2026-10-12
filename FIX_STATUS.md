# Fix status

Baseline inspected: `e072f94be19827be5e4b2f28e1cbc6562ab2a8b3` on `main`, 2026-10-12 (Africa/Lagos). This ledger deliberately distinguishes a code fix from hosted-wallet observation.

| ID | Current disposition | Evidence / remaining action |
| --- | --- | --- |
| LD-001 | VERIFIED_FIXED (local) | `revalidatePlan` now includes `recipientTotal18` plus retained cap for ERC-20. The regression's final call explicitly models Arc-style `eth_call` without signed-request balance admission, so the old implementation fails it. |
| LD-002 | IMPLEMENTED_NOT_VERIFIED | Account/chain identity changes now also clear an in-flight `quoting` state; edits and late quote responses are invalidated. Browser race test remains required. |
| LD-003 | IMPLEMENTED_NOT_VERIFIED | Review exposes full, wrapping recipient addresses, exact batch values, and the exact native total (up to 18 decimals). Keyboard/mobile inspection remains required. |
| LD-004 | VERIFIED_FIXED (local) | Send view uses `parseNativeUsdc` for native, `parseUsdc` for ERC-20, with mode-specific help. |
| LD-005 | IMPLEMENTED_NOT_VERIFIED | Receipt comparison now treats an actual fee above the reviewed maximum as a mismatch, and the receipt UI explicitly distinguishes delivered settlement from fee-budget compliance. Fixture/browser acceptance remains required. |
| LD-006 | IMPLEMENTED_NOT_VERIFIED | New immutable public review snapshots are written to browser storage before opening the wallet, then attached to the broadcast hash. Legacy records remain unknown. |
| LD-007 | OPEN | Evidence recorder/verifier not reworked. |
| LD-008 | OPEN | Public proof-count/origin copy not re-audited. |
| LD-009 | OPEN | Narrative not re-audited. |
| LD-010 | OPEN | Residual presentation not re-audited. |
| LD-011 | OPEN | SDK setup/package work not re-audited. |
| LD-012 | IMPLEMENTED_NOT_VERIFIED | Root Node engine is `>=22.13`, matching pnpm 11.5; docs/CI consistency and frozen install remain to verify. |
| LD-013 | OPEN | Latest E2E CI failure has not been diagnosed in this local branch. |
| LD-014 | IMPLEMENTED_NOT_VERIFIED | CSV importer retains editable rows despite row errors; full acceptance matrix remains to verify. |
| LD-015 | IMPLEMENTED_NOT_VERIFIED | Relay rejects null/primitives through index-based validation; request-shape/upstream test coverage remains to add. |
| LD-016 | OPEN | Finalized history reread behavior not audited. |
| LD-017 | OPEN | Privacy/contact routing not audited. |
| LD-018 | OPEN | Focus restoration/provider-error work not completed. |
| LD-019 | OPEN | Release provenance/content verification not completed. |

No hosted paid flow was observed or submitted. No mainnet transaction, contract deployment, remote push, or deployment was attempted.
