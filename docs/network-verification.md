# Arc network verification

Every network fact LastDollar depends on, where it came from, and how it was checked against the live chain. Retrieved and verified on **2026-10-11**. Re-run the live checks at any time with `pnpm verify:network`, which writes `evidence/network-check.json`.

Nothing here was inferred from a testnet value, and the mainnet configuration was not derived by editing a testnet URL.

## Confirmed mainnet configuration

| Item | Value | Source | Live check |
|---|---|---|---|
| Chain ID | `5042` (`0x13b2`) | [docs.arc.io, Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc); [circlefin/skills use-arc](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md) | `eth_chainId` returned `0x13b2` on four providers |
| Primary RPC | `https://rpc.mainnet.arc.io` | Connect to Arc | Live, block ~25.4M, block age under 5 s |
| Other RPCs | `rpc.drpc.mainnet.arc.io`, `rpc.blockdaemon.mainnet.arc.io`, `rpc.quicknode.mainnet.arc.io` | Connect to Arc | All return chain `0x13b2` |
| Explorer | `https://explorer.arc.io` | Connect to Arc | Reachable in a browser; its API sits behind a Cloudflare challenge for scripted clients |
| Native currency | USDC, 18 decimals | Connect to Arc; [EVM differences](https://docs.arc.io/arc/references/evm-differences) | `eth_getBalance` values are 18-decimal |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000`, 6 decimals | [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) | `decimals()` = 6, `symbol()` = `USDC`, `name()` = `USDC` |
| Token implementation | Proxy with code; implementation slot (FiatToken / ZeppelinOS layout) points to `0xc6ad664ac6679f4ce74e10e91449c93ec1ae3ca6` | — | `eth_getCode` non-empty; `eth_getStorageAt` on the ZeppelinOS slot |
| `isBlacklisted(address)` | Available | — | `eth_call` returns a boolean |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Contract addresses | Not used by LastDollar |
| viem chain object | `arc` in `viem/chains` (viem 2.57.4) matches the values above | viem source | Compared field by field |

## Fee mechanics

From [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees) and [EVM differences](https://docs.arc.io/arc/references/evm-differences):

- EIP-1559 transactions. The base fee is smoothed with an exponentially weighted moving average, not recalculated per block.
- Minimum base fee 20 gwei. Transactions with `maxFeePerGas` below 20 gwei are dropped by the mempool.
- The next block's base fee is published in the parent header's `extraData`.
- The base fee goes to the block beneficiary rather than being burned.
- A priority fee of 0 is accepted; a small tip can help under load.
- Finality is sub-second; block timestamps can repeat.

Discrepancy noted: the gas-and-fees page says its parameters reflect the testnet configuration and may change for mainnet. LastDollar therefore checks mainnet itself instead of relying on that page:

| Observation (mainnet, 2026-10-11) | Value |
|---|---|
| `baseFeePerGas` in recent blocks | `0x4a817c800` = 20 gwei, constant across `eth_feeHistory` |
| `extraData` | `0x00000004a817c800`: an 8-byte big-endian next base fee of 20 gwei, as documented |
| `eth_maxPriorityFeePerGas` | `0x47f` (1151 wei) |
| Native transfer to an EOA | `eth_estimateGas` = 21000 |
| ERC-20 `transfer` (existing recipient) | ≈ 49,300 gas estimated |
| ERC-20 `transfer` observed in a block | 73,950 gas used |
| Native transfer observed in a block | 21,055 gas used, so LastDollar never assumes exactly 21000 and always estimates |

**Fee policy chosen from this:** `maxFeePerGas = max(nextBaseFee, 20 gwei) × 1.25 + priority`; `gasLimit = ceil(estimate × 1.10) + 2000`; priority fee = RPC suggestion clamped to [0, 2 gwei]. Because the base fee is smoothed and has been flat at the floor, 1.25× headroom keeps a reviewed request valid for many blocks while keeping the reserved budget small. At these values the budget for an ERC-20 transfer is about 0.0014 USDC and the expected fee about 0.00099 USDC.

## One balance, two views

Documented in [EVM differences](https://docs.arc.io/arc/references/evm-differences) and [arc-node issue #91](https://github.com/circlefin/arc-node/issues/91):

- `eth_getBalance` returns 18-decimal native USDC.
- `USDC.balanceOf` returns the same funds through a 6-decimal view.
- The 6-decimal view **truncates**. Amounts below 10^-6 USDC are invisible to it and cannot be moved with ERC-20 `transfer`.

**Live check:** for four unrelated mainnet accounts read at the same block, `balanceOf == floor(eth_getBalance / 10^12)` held exactly every time, including accounts with sub-micro remainders such as `916707859154` wei. This relationship is asserted by `pnpm verify:network`, checked at quote time (`viewsConsistent`), and a mismatch produces a warning instead of being silently trusted.

The two numbers are never added together anywhere in LastDollar.

## Native value transfer semantics

From [EVM differences](https://docs.arc.io/arc/references/evm-differences), with live checks where possible:

| Behaviour | Documented | Live check |
|---|---|---|
| Value transfer to `0x0` | Reverts with `Zero address not allowed` | `eth_call` with value 1 to `0x0` reverted with exactly that message |
| Transfer to or from a blocklisted address | Reverts and still consumes gas if included | Not exercised on chain; LastDollar checks `isBlacklisted` for the payer and every recipient before quoting |
| Value to contracts | Can revert for the reasons above, or if the contract rejects it | Covered by simulation before signing |
| Value to a self-destructed account | Reverts (forbidden burn) | Not exercised |
| `PREVRANDAO` | Always 0 | Not used |
| Blob transactions | Rejected | Not used |

## Transfer logs (EIP-7708)

Arc emits a standard `Transfer(address,address,uint256)` log from the system address `0xfffffffffffffffffffffffffffffffffffffffe` for native value movement, with an 18-decimal amount. Gas deductions emit no log.

**Live check, native transfer** (`0x06b8c996…5359`): one log, from `0xff…fe`, amount `0x4b1f430f5d922e3f` = the transaction `value`.

**Live check, ERC-20 transfer** (`0x4b75d552…0080`): **two** logs for one movement:

1. from `0xff…fe`: amount `0x05ceacf8cdffe000` = 418,462 × 10^12 (18 decimals)
2. from `0x3600…0000`: amount `0x6629e` = 418,462 (6 decimals)

Reconciliation therefore prefers the token log for ERC-20 transfers and counts a matching system log as a mirror, never as a second payment. Both receipts are stored as fixtures in `packages/sdk/test/fixtures/mainnet-receipts.json` and drive the reconciliation tests.

## Contract deployment and explorer verification

The deploy-contracts tutorial covers Circle's template-based deployment and does not document explorer verification. Arc also offers an "Arc Foundry" fork; standard Foundry 1.5.1 was used to compile, and deployment uses viem from `tools/deploy-splitter.mjs`. `eth_estimateGas` for the splitter's creation code on mainnet returned 441,693 gas.

The explorer's API is behind a Cloudflare challenge for scripted clients, so automated source verification may not be possible. LastDollar records the runtime bytecode hash from two RPC providers and compares it with the local build (`pnpm verify:evidence`). On 2026-10-12, `forge verify-contract --verifier blockscout` received a Cloudflare challenge page instead of an API response, so source verification is not automated. The exact compiler input is published at `evidence/mainnet/splitter-standard-input.json` for manual verification in the explorer's web interface; the bytecode match on two RPCs is the verifiable claim in the meantime.

## Wallet configuration

Arc mainnet is built into viem and wagmi as `arc`. A wallet that does not know the chain receives a `wallet_addEthereumChain` request through wagmi's switch-chain flow, and only when the user clicks **Switch**. LastDollar never switches networks automatically.

## Re-verification

```sh
pnpm verify:network   # chain id on all RPCs, block freshness, fees, token metadata, balance views, zero-address revert
```

The script exits non-zero if any gate fails. The app also enforces chain identity at runtime: every quote calls `eth_chainId` on its RPC and refuses anything other than the configured chain, and execution refuses a wallet on another chain.

## Observed during the mainnet proofs (2026-10-12)

| Observation | Detail |
|---|---|
| Gas, native transfer to an EOA | 21,000 used |
| Gas, ERC-20 `transfer` | 48,938 used (fee 0.000978 USDC at 20 gwei) |
| Gas, 3-recipient splitter batch | 114,909 used (fee 0.002298 USDC) |
| Splitter deployment | 0.0094 USDC |
| `eth_call` with final caps, naive full-balance transfer | **Accepted** for both native and ERC-20, so simulation does not reveal the naive failure on Arc |
| `eth_sendRawTransaction`, naive full-balance native transfer | Rejected before inclusion: `insufficient funds for gas * price + value: have 207500004268100 want 732500004268100` |
| MetaMask balance-change preview on Arc | Offsets the network fee: a 0.001 USDC send previewed as "−0.000557"; a contract deployment previewed as "+0.00932 USDC". LastDollar's own review screen and the receipt show the real amounts |
| MetaMask with `maxPriorityFeePerGas = 0` | Shows a blocking fee alert ("~NaN min"); letting the wallet choose the fee avoids it |
| MetaMask domain warning | `lastdollar.vercel.app` triggers "Continue at your own risk" although it is not on the public eth-phishing-detect blocklist; a false-positive report is pending |
| Direct browser access to Arc RPCs | Failed from at least one user's browser while MetaMask worked; the app now reads through a same-origin read-only relay first, falling back to direct RPCs |
