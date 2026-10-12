# LastDollar

**Send exactly what you intend. Know what it costs. Verify what arrived.**

LastDollar is an open-source payment tool for USDC on [Arc](https://arc.io). On Arc, USDC is both the money being sent and the gas paid to send it, and the same balance appears as 18 decimals natively and 6 decimals through the token interface. LastDollar quotes the recipient amount and the network cost together, rechecks conditions immediately before your wallet signs, and reconciles the receipt from chain data.

- **Live app:** https://lastdollar.vercel.app (Arc mainnet)
- **Mainnet proof:** `/proof` on the live app, and [evidence/mainnet](evidence/mainnet)
- **SDK:** [`packages/sdk`](packages/sdk) (`@lastdollar/arc`)

## What ships

| Capability | Status |
|---|---|
| Exact payments, native and ERC-20 | Proven on mainnet: [native](https://explorer.arc.io/tx/0x2a73bfe16ae49a560ad6e0b8888f677228e06bdec2082c1eae8394c3cc03611c), [ERC-20](https://explorer.arc.io/tx/0x20097e74da7563afdbc22760a313c8ea2950e0614ff568fe2db34ce8e6fd42fb) |
| Send-max, native and ERC-20, with bounded fee reserve | Proven on mainnet: [native](https://explorer.arc.io/tx/0x11be46c80f9c2f7405f5a4257b4f31027d35720c69e24f699f309b8579196a14), [ERC-20](https://explorer.arc.io/tx/0xa687a1904a6739e7acd8fb708dce4c364bfb1b48df9b6c6b00c7f315848322db) |
| Atomic native batches (one transaction, no approval) through `LastDollarSplitter` | Contract [`0xFfF3…4944`](https://explorer.arc.io/address/0xFfF3427E2E3C9CEac64ebEb3F34e48485D434944); [3-recipient batch proven on mainnet](https://explorer.arc.io/tx/0x36e3472439ba7259523c97fe40a365959239c712adff461b50d1568ce90dcf55) |
| Quote, review, pre-signing recheck, sign, receipt reconciliation | Implemented in SDK and app |
| App-tracked history with refresh recovery | Implemented (browser-local, per chain and account) |
| Receipt lookup for any hash | Implemented |
| Public proof page, docs, developer page | Implemented |
| TypeScript SDK with packed-install verification | Implemented; registry publication pending |

The table is kept in sync with [evidence/mainnet/proofs.json](evidence/mainnet/proofs.json). Nothing is marked as proven on mainnet until a transaction exists and verifies on two RPC providers.

## How it works

1. **Quote.** Read the native and ERC-20 balance at one block. Estimate the exact call. Separate the *estimated fee* from the *maximum fee budget* (`gasLimit × maxFeePerGas`). For send-max, a bounded estimate-and-compute loop, then a final simulation with the exact caps.
2. **Review and recheck.** The user reviews every recipient and amount. Immediately before signing, balance, nonce and fees are re-read and the exact request is re-simulated. If the economic terms change, the user reviews again.
3. **Sign.** One signature in the user's own wallet. LastDollar never holds keys or switches networks.
4. **Verify.** The receipt's transfer logs are reconciled against what was reviewed. Arc emits both a native (EIP-7708) and an ERC-20 `Transfer` log for a token transfer, and LastDollar counts that movement once.

The math is in [docs/payment-math.md](docs/payment-math.md). Every network fact and its live check is in [docs/network-verification.md](docs/network-verification.md).

## SDK in 30 seconds

```ts
import { quoteExactPayment, preparePayment, executePayment, parseUsdc } from '@lastdollar/arc'

const quote = await quoteExactPayment({ publicClient, account, recipient, amount18: parseUsdc('25'), mode: 'erc20' })
if (quote.status === 'ready') {
  const { receipt } = await executePayment({ walletClient, publicClient, plan: preparePayment(quote) })
  console.log(receipt.status) // 'verified' | 'mismatch' | 'reverted'
}
```

See [docs/sdk.md](docs/sdk.md) and [examples/node](examples/node).

## Repository

```
apps/web          Next.js 16 app: landing, app (send, batch, history, receipts), proof, docs
packages/sdk      @lastdollar/arc: quote, prepare, revalidate, execute, verify (viem peer dependency)
contracts         LastDollarSplitter.sol and Foundry tests
examples/node     Exact, max, batch and receipt examples outside the web app
tools             Network verification, deployment, mainnet proof, evidence verification, pack test
evidence          Public machine-readable evidence (no secrets)
docs              Documentation rendered on the site
```

## Quickstart

Requirements: Node 22.13+, pnpm 11.5.0, and [Foundry](https://getfoundry.sh) for contracts.

```sh
pnpm install
pnpm sdk:build
pnpm dev                     # http://localhost:3000
```

Tests and checks:

```sh
pnpm test                    # SDK unit and property tests
pnpm test:contracts          # Foundry: unit, fuzz, invariant
pnpm test:integration        # SDK against a local anvil chain
pnpm e2e                     # Playwright: flows, responsive 320-1440px, axe, both themes
pnpm test:pack               # packed SDK installs and works in a fresh project
pnpm typecheck && pnpm lint
pnpm verify:network          # re-run Arc mainnet validation gates
pnpm verify:evidence         # re-check every mainnet proof on two RPCs
```

Operational scripts: `pnpm deploy:browser` (deploy the splitter with MetaMask), `pnpm deploy:record`, `pnpm proof:run` (plan, or `--execute`), `pnpm proof:record <id> <hash>` (record a payment made in the app), `pnpm test:record`.

## Limitations

- Not audited. Internal tests only.
- Quotes are conditional; the maximum fee budget bounds authorisation, not the fee paid.
- Send-max leaves the unused fee budget (and sub-micro dust in ERC-20 mode); it never promises an empty wallet.
- History is local to one browser and covers payments made through this app only.
- Browser wallets via EIP-6963 and injected providers. No WalletConnect or smart-account batching yet.
- 0x addresses only; no name resolution.
- Wallets that rewrite gas parameters are detected and reported, not prevented.
- MetaMask currently shows a "Continue at your own risk" warning for `lastdollar.vercel.app` (a false-positive report is pending), and its balance-change preview on Arc misstates amounts by offsetting the fee; LastDollar's review screen and receipts show the real figures.
- Chain reads use a same-origin, read-only relay (`/api/rpc`) when the browser cannot reach Arc's RPCs directly. It cannot send or sign anything.
- The splitter's source is not yet verified on the explorer (its API blocks scripted clients); its bytecode is verified against this repository on two RPC providers.

## License

[MIT](LICENSE). Dependencies (viem, wagmi, Next.js, React, TanStack Query, Radix, lucide, Geist, Tailwind CSS, forge-std) are MIT, Apache-2.0, ISC or OFL-1.1 and compatible with MIT distribution.

LastDollar is an independent project, not affiliated with Circle or Arc.
