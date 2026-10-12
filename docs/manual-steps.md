# Outstanding manual steps

Only actions that genuinely need the user. Everything else is done or automated.

## Done

- Proof wallet funded by the user (Account 1, `0xE306b8ae6e958F7C8e3401f1f12d550E5DAecab6`); signing happens in the user's MetaMask, and no key is shared.
- `LastDollarSplitter` deployed to Arc mainnet at `0xFfF3427E2E3C9CEac64ebEb3F34e48485D434944`, with runtime bytecode verified on two RPC providers (`evidence/mainnet/splitter-deployment.json`). An identical duplicate at `0xFE2555916e0311dc58A9bf98cfc1B8A7497F062C` was broadcast by mistake and is recorded as unused.

## 1. Proof payments (in the live app, signed with MetaMask)

Make each payment at https://lastdollar.vercel.app/app and record its hash with `pnpm proof:record <id> <hash> "<label>" --intended <recipient>=<amount>`:

| Id | Where | From → to | Amount |
|---|---|---|---|
| `native-exact` | Send, Exact amount, Native | Account 1 → Account 2 | 0.01 |
| `erc20-exact` | Send, Exact amount, ERC-20 | Account 1 → Account 2 | 0.01 |
| `native-batch` | Batch | Account 1 → Account 2 (0.02) and Account 3 (0.01) | 0.03 total, one transaction |
| `erc20-max` | Send, Send maximum, ERC-20 | Account 2 → Account 1 | computed |
| `native-max` | Send, Send maximum, Native | Account 3 → Account 1 | computed |

Account 3 is a third MetaMask account created only for the native send-max proof.

## 2. Connect Vercel to GitHub

After the repository is pushed, run `vercel git connect https://github.com/TheWeirdDee/lastdollar` (or in the Vercel dashboard: project → Settings → Git → connect the repository). If Vercel cannot see the repository, grant the Vercel GitHub app access to it.

## 3. MetaMask phishing warning

MetaMask shows "Continue at your own risk" for `lastdollar.vercel.app`. The domain is not on MetaMask's public blocklist; report a false positive at https://github.com/MetaMask/eth-phishing-detect/issues with the repository link.

## 4. Builder profile and submission

Provide a public builder profile (GitHub, X or Farcaster) and review [submission.md](submission.md). Submit on DoraHacks before **October 14, 2026, 23:59 ET**. Submitting and any identity verification are the user's to do.

## Optional

- npm publication of `@lastdollar/arc` (needs an npm account with the `@lastdollar` scope).
- Explorer source verification on explorer.arc.io (Solidity 0.8.30, optimizer 10,000 runs, EVM `cancun`).
