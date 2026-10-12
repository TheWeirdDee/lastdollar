# Design direction

Written before the interface was built. Observations are kept separate from the choices LastDollar makes.

## References inspected

Both references were opened in a headless Chromium (Playwright 1.64) on 2026-10-11 at 1440x900 and 390x844, scrolled through, and screenshotted. Computed styles were read for the body and the first headings.

### divyd.africa: observations

- Warm off-white canvas, near-black text (`rgb(31,26,23)`), one saturated orange accent used for the primary CTA, a period in the wordmark and small highlights.
- Display face Sora at 800 weight, 64px hero headline, 34px section headings; body in a system sans with generous line height.
- Hero: left-aligned headline, short supporting paragraph, two CTAs (filled accent plus dark), a row of small pill "trust chips". Real product screens on the right.
- Sections alternate: a dark rounded full-width band for the problem statement, then three equal cards each with a real app screenshot, a heading and two short bullets.
- A stepped walkthrough with a progress indicator, one feature per step, product screen beside it.
- Mobile: the headline centres, the CTAs sit side by side at full width, and the product screens stack under the text. The trust chips become a horizontally scrolling strip, which clips text at the edges.

### chronicle-ai-web.vercel.app: observations

- Dark-first. Near-black surfaces (`rgb(15,15,16)`), white text, lime accent. Outfit at 500–600 weight; the hero is 72px with an italic serif accent phrase.
- Floating pill navigation with a primary CTA that has a separate arrow tile.
- The hero sits over a textured illustrated image. The supporting paragraph is long and dense: pricing, the product loop and partner names all appear in it.
- A numbered vertical timeline (icon node, connecting line, heading, paragraph) explains the lifecycle. Large lime and dark-green cards present the two halves of the business loop.
- A theme toggle sits fixed in the bottom-right corner.
- Mobile: the nav collapses to a hamburger inside the pill and the hero stacks. The long paragraph becomes a wall of text.

### What we take, and what we avoid

Take: one accent used with discipline, heavy tight-tracked display headings, real product UI as the hero visual, short benefit-led hero copy, three equal capability cards, a numbered vertical lifecycle, a calm FAQ.

Avoid: the long, dense hero paragraph; decorative textured imagery; a scrolling chip strip that clips on mobile; mixing a black CTA with an accent CTA in the same group; the italic serif accent.

## LastDollar's choices

### Character

A precise financial instrument rather than a token dashboard: neutral surfaces, numbers that read first, and one confident accent. Motion confirms state changes and never decorates a payment task.

### Palette

Every colour is a CSS custom property on `:root`, with a dark set under `.dark` (class strategy via `next-themes`, persisted, no flash).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F6F3` | `#0C0D0F` | Page canvas |
| `--surface` | `#FFFFFF` | `#141619` | Cards, inputs |
| `--surface-2` | `#EFEFEA` | `#1B1E22` | Wells, table headers |
| `--border` | `#E1E1DA` | `#2A2E34` | Hairlines |
| `--text` | `#15150F` | `#EDEDE9` | Primary text |
| `--muted` | `#5D5D55` | `#A3A59E` | Secondary text (AA on both surfaces) |
| `--accent` | `#2346CF` | `#8098FF` | The single accent: primary buttons, links, focus |
| `--accent-fg` | `#FFFFFF` | `#0C0D0F` | Text on accent |
| `--accent-soft` | `#E7EBFB` | `#1A2244` | Selected states, highlights |
| `--success` | `#127A3D` | `#4FCB82` | Verified, ready |
| `--warning` | `#9A5600` | `#F0B354` | Stale, attention |
| `--danger` | `#B42318` | `#FF7B6B` | Blocked, failed |

Cobalt was chosen so the accent never collides with the green success state: an action never reads as "verified", and the reverse holds too. No gradients on controls. A single, very faint radial wash of the accent sits behind the hero only.

### Typography

- Geist Sans for UI and headings, Geist Mono for addresses, hashes and code. Both are self-hosted through `next/font`, so there is no layout shift.
- Display: 600 weight, `letter-spacing: -0.035em`, clamp from 2.5rem (mobile) to 4.25rem (desktop).
- Section headings 600, clamp 1.75–2.5rem. Body 1rem / 1.6, measure capped near 65ch.
- Every amount uses `font-variant-numeric: tabular-nums` so columns of figures align.

### Spacing and layout

- 4px base scale. Section padding 96px desktop, 64px mobile. Content max width 1200px. Side gutter 16px (mobile) to 32px.
- Radii: 10px controls, 16px cards, 999px pills.
- Cards have a hairline border and no heavy shadow; elevation comes from surface colour. Popovers and dialogs get one soft shadow.

### Components and states

Buttons (primary, secondary, ghost, danger) and inputs each define hover, `:focus-visible` (2px accent ring with offset), disabled, loading (spinner plus label change, with `aria-busy`) and, where relevant, selected, error and success. Segmented controls are used for Exact/Max and Native/ERC-20 (radio-group semantics). Status uses icon, colour and words together, never colour alone. Dialogs trap focus, close on Escape and restore focus. Errors render as a summary with links to the fields.

### Iconography and brand

lucide-react only, 1.75 stroke, sized to the text. No emoji anywhere. The mark is an original inline SVG: a rounded square in the accent holding an "L" stroke with a single coin dot at its open end, for the last unit accounted for. The wordmark is "LastDollar" in Geist at 600 weight with tight tracking.

### Motion

150–220ms ease-out for colour, opacity and transform. Sections fade and rise 8px on entry once (IntersectionObserver). Status changes cross-fade. All of it is disabled under `prefers-reduced-motion`. There is no scroll hijacking, no marquees, and no animation inside the review-and-sign step beyond the progress indicator.

### Mobile adaptations

- Checked at 320, 375, 390, 430 px and at 768, 1024 and 1440 px.
- Navigation collapses to a menu button that opens an accessible sheet (focus trapped, Escape closes, focus returns to the trigger).
- The app uses a bottom tab bar on mobile (Overview, Send, Batch, History) and a top bar on desktop. The wallet control stays in the header in both layouts, never duplicated.
- Batch rows become stacked cards below 640px. Long addresses truncate in the middle with the full value available to copy.
- Nothing scrolls horizontally except code blocks and the batch table, and both are deliberately scoped.
