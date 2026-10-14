# LastDollar demo: script and storyboard (final)

Length 2:23. Narration: `en-US-AndrewNeural` (edge-tts, rate −16%), one file per segment in `public/audio/vo/`. Footage: screen recordings of the live site in the owner's Chrome on 2026-10-14, cropped to the page viewport. Network: **Arc mainnet, real USDC**.

The demo payment is `browser-native-max` in `evidence/mainnet/proofs.json`: Send maximum, Native, Account 2 (`0x97f3…dE8d`) → Account 1 (`0xE306…cab6`), both owned by the presenter, signed by the owner in MetaMask. See `EVIDENCE.md`.

## Narration and storyboard

Timing comes from `tools/build-plan.mjs` (each segment is 0.45 s lead + narration + 0.7 s tail). Clip names refer to `public/clips/`, cut by `tools/cut-clips.sh`.

| # | Starts | Footage | Highlights | Narration |
|---|---|---|---|---|
| 1 | 0:00 | `k01` /app/send, balance 0.033 | Push-in; box **Available balance** | You press send max. But what happens when the fee comes from that same balance? |
| 2 | 0:06 | `k02` landing, "The problem" | Box **Fee and payment: one balance**; underline the explanation | On Arc, the money and the gas are the same USDC. Every transaction needs a network fee, paid from the balance you're sending. Try to send every cent, and nothing is left to pay for it. |
| 3 | 0:22 | `k03` landing hero | Box on the headline | LastDollar shows what you can actually send, what the fee may cost, and what remains, before you approve anything. |
| 4 | 0:31 | `k04` /app/send, recipient pasted | **Arc mainnet · real USDC**, **Connected with MetaMask**, **About three cents**, **My other wallet** | This is the live app on Arc mainnet, with real USDC. I am connected with MetaMask, using a small wallet that holds about three cents. I will send its maximum to my other wallet. |
| 5 | 0:45 | `k05a` Send maximum, Native → `k05b` quoting → `k05c` quote | **Offered: everything except the fee budget**, **Probably costs** (0.00042), **At most** (0.000627) | I choose Send maximum, and native USDC. LastDollar estimates the real transaction, sets aside a maximum fee budget, and offers everything else. The estimated fee is what it will probably cost. The budget is the most it can cost. |
| 6 | 1:04 | `k06` remaining balance row | **Stays behind** (0.000207); underline the explanation | Because the real fee is usually below the budget, a tiny amount stays behind. LastDollar says so up front, instead of promising an empty wallet. |
| 7 | 1:17 | `k07` review, checkbox, Recheck and sign (1.35× speed) | **Full recipient address**, **Total**, **Reviewed and acknowledged** | Before anything is signed, I confirm the recipient and the amount. When I continue, LastDollar rechecks my balance, nonce and fees. If anything changed, it would ask me to review again. |
| 8 | 1:32 | `k08a` MetaMask request → `k08b` Confirm clicked | Badge **MetaMask · approved by the wallet owner** | Then I approve the payment in MetaMask. |
| 9 | 1:36 | `k09a` Payment verified → `k09b`/`k09c` full receipt | **Read from the chain receipt**, **Exactly the reviewed amount**, **Actual fee**, **Inside the budget** | Confirmed. LastDollar reads the receipt from the chain. The recipient got exactly the reviewed amount, and the actual fee, less than a twentieth of a cent, stayed inside the budget. What is left in the wallet is the unused part of that budget. |
| 10 | 1:54 | `k10a` Arc explorer → `k10b` /proof Re-verify live | **Arc explorer**, **Success**, **Re-verified live, in the browser** | Anyone can check it on the Arc explorer. The proof page lists the mainnet payments, and re-verifies each one live from the chain, in your browser. |
| 11 | 2:06 | `k11` /developers, then end card | **TypeScript SDK**; end card with URL and repo | LastDollar is open source, with a TypeScript SDK so other Arc apps can use the same checks. Try it at lastdollar dot vercel dot app. |

## Facts behind each claim

- Quote on screen: recipient receives 0.0323724999664413 USDC, estimated fee 0.00042, maximum fee budget 0.000627, maximum total debit 0.033, remaining about 0.000207 (at least 0.00).
- Chain receipt: delivered 0.0323724999664413 USDC; fee 0.000420000028077 USDC (21000 gas × 20.000001337 gwei); submitted cap 0.0006275000335587. Sender went from 0.033 to 0.0002075000054817 USDC. "Less than a twentieth of a cent": 0.00042 USDC = 0.042 cents.
- "About three cents": the wallet held 0.033 USDC.
- The re-verify shot (segment 10) shows an earlier proof entry (`native-exact`), not the demo payment; the narration says the page re-verifies "each one", which the button does per entry.

## Edits made to the footage

- The MetaMask confirmation was cut to the request screen and the Confirm click. Removed: MetaMask's "High-risk request" site warning (MetaMask flags lastdollar.vercel.app; the owner read the alert and acknowledged it before confirming), and a few seconds afterwards in which the desktop and the code editor were briefly visible.
- The review clip plays at 1.35×; static shots are slowed where needed to fit the narration. No numbers or UI were altered.
- Footage is cropped to the page viewport: no tab strip, bookmarks bar or taskbar.
- No wallet unlock screen, password or recovery information was recorded. The wallet was already unlocked by the owner before recording.

## Capture

Recorded with ffmpeg `gdigrab` (1920×1080, 30 fps). The agent drove Chrome with `tools/desk.ps1`; the owner clicked Confirm in MetaMask. Raw takes are in `footage/` (not committed: large, and they contain the uncut wallet screens).
