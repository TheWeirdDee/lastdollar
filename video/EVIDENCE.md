# Transaction shown in the demo video

| Field | Value |
|---|---|
| Evidence id | `browser-native-max` (`evidence/mainnet/proofs.json`) |
| Hash | `0xb2c5fa7a4e84a94850378ba4346b4966fe7fc6290fdf549d3cc11162de6a6c49` |
| Explorer | https://explorer.arc.io/tx/0xb2c5fa7a4e84a94850378ba4346b4966fe7fc6290fdf549d3cc11162de6a6c49 |
| Network | Arc mainnet, chain 5042 |
| Block / time | 25877539 · 2026-10-14 06:12:05 UTC |
| Operation | Native USDC transfer (LastDollar **Send maximum**, **Native**) |
| From | `0x97f32Ba0b4DD5c274DFD9C2A7e6Aa403a9B7dE8d` (Account 2, owner's wallet) |
| To | `0xE306b8ae6e958F7C8e3401f1f12d550E5DAecab6` (Account 1, owner's wallet) |
| Signed by | The wallet owner, clicking Confirm in MetaMask in their own Chrome profile. The agent prepared the payment in the app and never had this wallet's key. |

## Quote reviewed before signing (as filmed)

| | USDC |
|---|---|
| Recipient receives | 0.0323724999664413 |
| Estimated network fee | 0.00042 |
| Maximum fee budget | 0.000627 |
| Maximum total debit | 0.033 |
| Remaining balance (estimated · at least) | 0.000207 · 0.00 |

## What the chain shows

| | Value |
|---|---|
| Delivered | 0.0323724999664413 USDC, exactly the reviewed amount |
| Gas used / limit | 21000 / 25100 |
| Effective gas price | 20.000001337 gwei |
| Actual fee | 0.000420000028077 USDC |
| Submitted fee cap | 0.0006275000335587 USDC (fee within cap) |
| Sender before → after | 0.033 → 0.0002075000054817 USDC |

The amount left behind (0.0002075 USDC) equals the unused fee budget, as the quote said it would.

## How it was checked

- `pnpm proof:record browser-native-max <hash> … --intended 0xE306…=0.0323724999664413` reconciled the receipt on two RPC providers (`rpc.mainnet.arc.io`, `rpc.drpc.mainnet.arc.io`); both agree, no issues.
- `pnpm verify:evidence`: 9 mainnet entries checked on 2 RPCs, 0 failures.
- The app's own result card and receipt page (filmed) show the same delivered amount and fee, and "Every payout matches the amounts reviewed in this browser."
- Provenance in the evidence file is `browser-wallet`, with the source described as filmed in the live app and MetaMask. The reviewed quote is on film, not in an exported file.

## Other on-screen evidence

The proof-page shot re-verifies `native-exact` (`0x2a73bfe1…3611c`, block 25560594): "Matches chain data now: 1 payout(s), fee 0.00042 USDC, block 25560594." That is an earlier scripted proof, not the demo payment.
