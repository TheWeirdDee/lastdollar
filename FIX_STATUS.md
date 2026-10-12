# Fix status

Baseline inspected: `e072f94be19827be5e4b2f28e1cbc6562ab2a8b3` on `main`, 2026-10-12 (Africa/Lagos). This ledger deliberately distinguishes a code fix from hosted-wallet observation.

| ID | Current disposition | Evidence / remaining action |
| --- | --- | --- |
| LD-001 | VERIFIED_FIXED (local) | `revalidatePlan` now includes `recipientTotal18` plus retained cap for ERC-20. The regression's final call explicitly models Arc-style `eth_call` without signed-request balance admission, so the old implementation fails it. |
| LD-002 | IMPLEMENTED_NOT_VERIFIED | Account/chain identity changes now also clear an in-flight `quoting` state; edits and late quote responses are invalidated. Browser race test remains required. |
| LD-003 | IMPLEMENTED_NOT_VERIFIED | Review exposes full, wrapping recipient addresses, exact batch values, and the exact native total (up to 18 decimals). Keyboard/mobile inspection remains required. |
| LD-004 | VERIFIED_FIXED (local) | Send view uses `parseNativeUsdc` for native, `parseUsdc` for ERC-20, with mode-specific help. |
| LD-005 | OPEN | Receipt outcome semantics not changed in this revision. |
| LD-006 | IMPLEMENTED_NOT_VERIFIED | New immutable public review snapshots are written to browser storage before opening the wallet, then attached to the broadcast hash. Legacy records remain unknown. |
| LD-007 | OPEN | Evidence recorder/verifier not reworked. |
| LD-008 | OPEN | Public proof-count/origin copy not re-audited. |
| LD-009 | OPEN | Narrative not re-audited. |
| LD-010 | OPEN | Residual presentation not re-audited. |
| LD-011 | OPEN | SDK setup/package work not re-audited. |
| LD-012 | OPEN | CSV/API work not re-audited. |
| LD-013 | OPEN | History/privacy work not re-audited beyond new review snapshot. |
| LD-014 | OPEN | Security/contact work not re-audited. |
| LD-015 | OPEN | Responsive audit not run. |
| LD-016 | OPEN | Accessibility audit not run. |
| LD-017 | OPEN | Documentation consistency review not complete. |
| LD-018 | OPEN | Focus restoration/provider-error work not changed. |
| LD-019 | OPEN | Release provenance/content deployment work not changed. |

No hosted paid flow was observed or submitted. No mainnet transaction, contract deployment, remote push, or deployment was attempted.
