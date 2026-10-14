# Publishing the demo video

Files in `out/`:

| File | Use |
|---|---|
| `lastdollar-demo.mp4` | Main video, 1920×1080, captions burned in |
| `lastdollar-demo-clean.mp4` | Same edit without captions (for platforms that show the sidecar captions) |
| `lastdollar-demo.srt`, `lastdollar-demo.vtt` | Caption files matching both videos |
| `thumbnail.png` | 1280×720 thumbnail made from a real frame of the quote |

Nothing has been uploaded. These steps are for the owner.

## YouTube

1. studio.youtube.com → **Create → Upload videos** → choose `lastdollar-demo-clean.mp4`.
2. Title: `LastDollar: send max on Arc when USDC is also the gas`
3. Description:

   ```
   LastDollar quotes what you can actually send when the network fee comes out of the same USDC balance on Arc, rechecks before your wallet signs, and verifies the result from the chain receipt.

   Filmed on Arc mainnet with real USDC. Demo transaction:
   https://explorer.arc.io/tx/0xb2c5fa7a4e84a94850378ba4346b4966fe7fc6290fdf549d3cc11162de6a6c49

   App: https://lastdollar.vercel.app
   Proof page: https://lastdollar.vercel.app/proof
   Source: https://github.com/TheWeirdDee/lastdollar
   ```

4. **Thumbnail → Upload file** → `thumbnail.png`.
5. Audience: **No, it's not made for kids**.
6. **Subtitles → Add → Upload file → With timing** → `lastdollar-demo.srt` (English).
7. Visibility: **Unlisted** for a hackathon link, or **Public**. Save and copy the link.

If you upload `lastdollar-demo.mp4` (captions burned in) instead, skip step 6 so captions don't show twice.

## DoraHacks submission

Paste the YouTube link in the BUIDL's demo video field. If the form takes a file instead, use `lastdollar-demo.mp4`.

## X / LinkedIn

Upload `lastdollar-demo.mp4` (captions burned in; most viewers watch muted). Both accept 2:23 at 1080p.

## Re-rendering

```
cd video
npm install
bash tools/cut-clips.sh        # needs the raw takes in footage/
node tools/build-plan.mjs      # timing, highlights, SRT/VTT
npm run render                 # out/lastdollar-demo.mp4
npm run render:clean           # out/lastdollar-demo-clean.mp4
npx remotion still Thumbnail out/thumbnail.png
```
