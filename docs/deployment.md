# Deployment

## Web app (Vercel)

The app is a Next.js 16 project in `apps/web` inside a pnpm workspace. It needs no server-side secrets: all chain access happens from the browser to public Arc RPC endpoints.

Project settings:

| Setting | Value |
|---|---|
| Root directory | `apps/web` |
| Install command | `pnpm install --frozen-lockfile` (run from the repository root) |
| Build command | `pnpm --filter @lastdollar/arc build && pnpm --filter @lastdollar/web build` |
| Output | Next.js default |
| Node | 20.18 or later |

Environment variables (all optional, all public):

| Name | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata | `https://lastdollar.vercel.app` |
| `NEXT_PUBLIC_SPLITTER_ADDRESS` | Override the splitter address | read from `evidence/mainnet/splitter-deployment.json` |
| `NEXT_PUBLIC_ARC_RPC_URL` | Override the RPC (its origin is added to the CSP) | `https://rpc.mainnet.arc.io` |
| `NEXT_PUBLIC_NETWORK_MODE` | `local-test` is for automated tests only and shows a test banner | mainnet |

The build runs `apps/web/scripts/sync-content.mjs`, which copies `evidence/` and `docs/` into the app so the proof and docs pages render exactly what is committed. Redeploy after evidence changes.

Security headers are set in `next.config.ts`: a CSP that allows connections only to `*.arc.io` (plus an explicit RPC override), `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and a restrictive permissions policy. `/app/*` responses are `no-store`.

Smoke test after each deploy:

1. Open `/` and `/proof` in a private window without a wallet.
2. Open `/app/send`, connect a wallet, switch networks if prompted, and request a small quote. Do not sign unless you intend to pay.
3. Look up a proof hash at `/app/transactions/<hash>`.
4. Toggle themes and reload; check a phone-width viewport.

## Splitter contract

```sh
cd contracts && forge install foundry-rs/forge-std --no-git && forge build && forge test
cd .. && pnpm deploy:splitter            # dry run: estimate and cost
pnpm deploy:splitter --execute           # broadcast from the proof payer wallet
pnpm verify:evidence                     # bytecode identity on two RPCs
```

The deploy script refuses any chain other than 5042, checks the balance against the maximum budget, waits for the receipt, compares the runtime bytecode on two RPC providers with the local build, and writes `evidence/mainnet/splitter-deployment.json`. It has no constructor arguments, owner or initialisation.

Compiler settings: Solidity 0.8.30, optimizer enabled with 10,000 runs, EVM version `cancun`, IPFS metadata hash. Explorer source verification is attempted separately; its result is recorded in the deployment file.

## SDK package

```sh
pnpm sdk:build && pnpm test:pack       # build and prove the tarball installs
cd packages/sdk && npm publish --access public   # requires registry authorisation
```

The package name `@lastdollar/arc` was unclaimed when checked on 2026-10-11. Publishing needs an npm account with access to the `@lastdollar` scope.
