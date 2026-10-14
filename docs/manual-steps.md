# Outstanding manual steps

Only actions that genuinely need the user. Everything else is done or automated.

## Done

- Proof wallet funded by the user (Account 1, `0xE306b8ae6e958F7C8e3401f1f12d550E5DAecab6`). The splitter deployment and the three `browser-*` payments were signed in the user's MetaMask. For the five scripted proofs, the user shared Account 1's private key in a chat session so the SDK script could sign; it was stored only in a key file outside the repository and never committed. Because it was shared, treat that key as exposed.
- `LastDollarSplitter` deployed to Arc mainnet at `0xFfF3427E2E3C9CEac64ebEb3F34e48485D434944`, with runtime bytecode verified on two RPC providers (`evidence/mainnet/splitter-deployment.json`). An identical duplicate at `0xFE2555916e0311dc58A9bf98cfc1B8A7497F062C` was broadcast by mistake and is recorded as unused.

## 1. Proof payments

Done: five scripted proofs, three owner-reported browser payments and one filmed MetaMask send-max (`browser-native-max`), all verified on two RPC providers (`evidence/mainnet/proofs.json`).

Still to do: move the remaining funds from Account 1 to a freshly created account in MetaMask, and stop using Account 1. Never paste a recovery phrase or private key anywhere to do this.

## 2. Vercel and GitHub

Done: the Vercel project deploys automatically from `main` on GitHub.

## 3. MetaMask phishing warning

MetaMask shows "Continue at your own risk" for `lastdollar.vercel.app`. The domain is not on the public eth-phishing-detect or ChainPatrol lists (ChainPatrol reports `UNKNOWN`, reason `hosting-domain`), so the warning appears to come from MetaMask's live risk scanning of a new site on shared `vercel.app` hosting. Use the report link inside the MetaMask warning, or support.metamask.io, to report a false positive. A dedicated domain is the more durable fix.

## 4. Builder profile and submission

Provide a public builder profile (GitHub, X or Farcaster) and review [submission.md](submission.md). Submit on DoraHacks before **October 14, 2026, 23:59 ET**. Submitting and any identity verification are the user's to do.

## Optional

- npm publication of `@lastdollar/arc` (needs an npm account with the `@lastdollar` scope).
- Explorer source verification by hand on explorer.arc.io: "Solidity (Standard JSON input)", compiler 0.8.30, upload `evidence/mainnet/splitter-standard-input.json` (automated verification is blocked by Cloudflare).
