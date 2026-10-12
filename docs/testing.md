# Testing

Five layers, each labelled for what it proves. Only the last layer is chain evidence.

| Layer | Command | What it proves | What it does not |
|---|---|---|---|
| SDK unit and property | `pnpm test` | Parsing, scale conversion, truncation, precision rejection, affordability boundaries, send-max formulas (randomised properties), fee policy, CSV strictness, error classification, quote and revalidation logic against a deterministic in-memory RPC, receipt reconciliation against **real mainnet receipts** stored as fixtures | Live network behaviour |
| Contract | `pnpm test:contracts` | Splitter payouts, every revert path, 200-recipient limit, overflow, duplicates, reverting, receive-less and gas-hungry receivers, reentrancy (swallowed and bubbled), forced balance, fuzzed value conservation, invariants for no custody | Arc-specific native semantics |
| SDK integration | `pnpm test:integration` | Real signing, broadcast and receipts on a local anvil chain (chain id 5042, 20 gwei base fee): exact, send-max (exact residual), atomic batch through the real splitter, stale-quote refusal with no broadcast, wallet rejection, wrong chain, wrong account, blocked reverting batch | ERC-20 execution and EIP-7708 logs (anvil implements neither; the tests assert reconciliation refuses to verify without them) |
| Browser | `pnpm e2e` | Production build in a labelled local-test mode, an injected EIP-6963 wallet stub, anvil: connection states, refusal to sign on connect, refresh, wrong network and switching, account change invalidating a quote, validation summaries, full send flow, rejection, stale quote requiring renewed review, CSV import errors, duplicate acknowledgement, atomic batch, pending recovery after refresh, unknown and malformed hashes, theme persistence, mobile menu focus, no horizontal overflow at 320–1440 px in both themes, axe WCAG 2.2 AA rules on 11 routes in both themes | Real wallet extensions |
| Mainnet | `pnpm proof:run --execute` then `pnpm verify:evidence` | Real Arc mainnet transactions for every published capability, reconciled and re-verified on a second RPC provider | Third-party usage |

Additional checks:

- `pnpm test:pack` packs the SDK and installs the tarball into a fresh project (ESM, CJS and TypeScript).
- `pnpm verify:network` re-runs the Arc network validation gates.
- `pnpm test:record` runs the suites and writes `evidence/test-results/summary.json`, which the proof page displays.
- `pnpm typecheck` includes `apps/web/src/lib/snippets.check.ts`, a compiled mirror of every code snippet shown on the site.

## Test doubles

- `packages/sdk/test/mockChain.ts`: an in-memory JSON-RPC model of one balance with an 18-decimal and a truncated 6-decimal view, a fee-aware `eth_call`, nonces, a blocklist and contract code.
- `contracts/test/mocks/MockArcUsdcView.sol`: a view-only stand-in at `0x3600…0000` on anvil so balance reads work. It cannot move native value; ERC-20 transfers revert by design.
- `apps/web/e2e/wallet-stub.ts`: an EIP-1193 provider announced via EIP-6963 that forwards to anvil's unlocked dev accounts. Tests can make it decline, change account or change chain.

The app itself never falls back to fabricated data. Test mode (`NEXT_PUBLIC_NETWORK_MODE=local-test`) exists only for these tests, and the app shows a permanent banner in that mode.

## Running everything

```sh
pnpm install
pnpm sdk:build
pnpm test && pnpm test:contracts && pnpm test:integration
pnpm --filter @lastdollar/web exec playwright install chromium
pnpm e2e
pnpm test:pack
```

Foundry (`forge`, `anvil`) must be installed in `~/.foundry/bin`. Contract tests need forge-std: `cd contracts && forge install foundry-rs/forge-std --no-git`.
