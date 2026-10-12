# Outstanding manual steps

Only actions that genuinely need the user. Everything else is done or automated.

## Done

- Proof wallet funded by the user (Account 1, `0xE306b8ae6e958F7C8e3401f1f12d550E5DAecab6`); signing happens in the user's MetaMask, and no key is shared.
- `LastDollarSplitter` deployed to Arc mainnet at `0xFfF3427E2E3C9CEac64ebEb3F34e48485D434944`, with runtime bytecode verified on two RPC providers (`evidence/mainnet/splitter-deployment.json`). An identical duplicate at `0xFE2555916e0311dc58A9bf98cfc1B8A7497F062C` was broadcast by mistake and is recorded as unused.

## 1. Proof payments

Done: all five proofs executed and verified on 2026-10-12 (`evidence/mainnet/proofs.json`). Afterwards, move remaining funds from Account 1 to a fresh account, since its key was shared in a chat session.

## 2. Vercel and GitHub

Done: the Vercel project deploys automatically from `main` on GitHub.

## 3. MetaMask phishing warning

MetaMask shows "Continue at your own risk" for `lastdollar.vercel.app`. The domain is not on MetaMask's public blocklist; report a false positive at https://github.com/MetaMask/eth-phishing-detect/issues with the repository link.

## 4. Builder profile and submission

Provide a public builder profile (GitHub, X or Farcaster) and review [submission.md](submission.md). Submit on DoraHacks before **October 14, 2026, 23:59 ET**. Submitting and any identity verification are the user's to do.

## Optional

- npm publication of `@lastdollar/arc` (needs an npm account with the `@lastdollar` scope).
- Explorer source verification by hand on explorer.arc.io: "Solidity (Standard JSON input)", compiler 0.8.30, upload `evidence/mainnet/splitter-standard-input.json` (automated verification is blocked by Cloudflare).
