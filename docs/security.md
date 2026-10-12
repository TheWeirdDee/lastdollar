# Security

**Status:** internal testing only. No external audit has been performed. Keep amounts modest.

## Trust boundaries

| Component | Trusted for | Not trusted for |
|---|---|---|
| User wallet | Holding keys, showing and signing transactions | Preserving dapp-supplied gas parameters (checked after the fact) |
| LastDollar app / SDK | Preparing requests, explaining costs, reconciling receipts | Custody, signing, or deciding to send |
| Arc RPC | Chain state and receipts | Being honest or available: chain id is checked on every quote, failures fail closed, and evidence is verified on a second provider |
| LastDollarSplitter | Forwarding exactly the authorised payouts within one call | Holding value (it holds none) |
| Browser storage | Convenience history and preferences | Settlement truth (status is always re-read from chain) |

There is no LastDollar server. Nothing off-chain can authorise spending.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| Unit confusion (18 vs 6 decimals) | Integer-only math with unit-suffixed names; the views are never summed; property tests; `viewsConsistent` check at quote time |
| Excess precision silently rounded | Rejected with `INVALID_PRECISION` in parsing, quoting and CSV import |
| Balance or fee change between quote and signature | `revalidatePlan` before every signature; changed terms require a new review (`STALE_QUOTE`) |
| Wrong network | Chain id checked on the RPC for every quote and on the wallet before signing; no automatic switching |
| Wallet changes account mid-flow | Quotes are bound to the account; the flow resets on account or chain change; execution checks `ACCOUNT_MISMATCH` |
| Double submission | One in-flight plan per tab, a cross-tab lock per account, the hash persisted before waiting, and quoting blocked while the account has a pending nonce |
| Wallet rewrites gas or fee caps | Detected from the broadcast transaction and reported; the budget comparison flags any overage |
| Replacement or cancellation | Speed-ups are followed to the replacement receipt; cancellations report `TRANSACTION_REPLACED`; vanished transactions become `unresolved`, never failed or paid |
| RPC outage | Errors classify as `RPC_UNAVAILABLE`; no balance or receipt is ever fabricated or cached as truth |
| Misleading success | Success requires a successful receipt and transfer logs matching the reviewed lines; ERC-20 mirror logs are not double counted |
| Recipient restrictions | `isBlacklisted` checked for payer and recipients; zero address rejected; final simulation with exact caps |
| Malicious batch recipient | Splitter uses a reentrancy lock, forwards all gas (no 2300-stipend failures), and reverts the whole batch on any failed payout |
| Excess or retained batch value | `msg.value` must equal the sum exactly; no receive function; the contract never reads its own balance |
| Unlimited token approvals | None: batches use native value, so no approval exists |
| Frontend supply chain | Pinned dependency versions with a lockfile; strict CSP (`connect-src` limited to `*.arc.io`); no analytics or third-party scripts |

## Splitter contract properties

Source: `contracts/src/LastDollarSplitter.sol` (Solidity 0.8.30, optimizer 10,000 runs, EVM `cancun`).

- `pay(address[] recipients, uint256[] amounts)` is payable. Up to 200 recipients.
- Reverts on: empty batch, length mismatch, too many recipients, zero recipient, the contract itself as recipient, zero amount, `msg.value` ≠ sum (including excess), checked-arithmetic overflow, any failed payout (`PayoutFailed(index, recipient, reason)`), and reentry.
- Emits `Payout(payer, recipient, amount, index)` per payout and `BatchPaid(payer, count, total)`.
- No owner, admin, upgrade path, fee, pause or rescue function.

Repeated recipients are paid once per entry. Forced deposits (for example via `SELFDESTRUCT`) stay in the contract forever because nothing can withdraw them; they do not affect any batch. Arc treats a `SELFDESTRUCT` beneficiary transfer as a normal native transfer.

Tests (`contracts/test/LastDollarSplitter.t.sol`, 22 cases): exact payouts including a 1-wei payout, every revert path, the 200-recipient boundary, overflow, duplicates, reverting receivers, receivers without a receive function, gas-hungry receivers, swallowed and bubbled reentrancy, rejected plain deposits, forced balance, fuzzed value conservation, fuzzed wrong-value rejection, and invariants for no custody and full payout.

## Known limitations

- Not audited.
- Quotes are conditional; fees and state can change before inclusion.
- A reverted transaction still costs gas.
- Wallet parameter rewrites are detected, not prevented.
- Browser-local history is not a complete wallet history.
- Only EIP-6963 and injected browser wallets are supported; no WalletConnect.
- No name resolution; 0x addresses only.
- Native batches to contracts require the contract to accept native value.

## Reporting

Use GitHub's private vulnerability reporting (Security → Advisories) on the repository. Please do not open public issues for vulnerabilities.
