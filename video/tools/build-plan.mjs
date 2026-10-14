// Builds the edit decision list for the demo: segment timing from the narration audio, clip
// schedule, highlight boxes (in 1920x826 clip pixels) and captions. Writes src/plan.json plus
// out/lastdollar-demo.srt and .vtt so the burned-in captions and the sidecar files match.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FPS = 30
const LEAD = 0.45 // silence before each narration line
const TAIL = 0.7 // silence after it
const END_CARD = 5

const probe = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(root, file)]).toString().trim())

// Sentence cues from edge-tts, used to time highlights to what is being said.
const cuesFor = (id) => {
  const text = readFileSync(join(root, 'public/audio/vo', `${id}.vtt`), 'utf8')
  const ts = (s) => {
    const [h, m, rest] = s.split(':')
    return Number(h) * 3600 + Number(m) * 60 + Number(rest.replace(',', '.'))
  }
  const cues = []
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(Boolean)
    const at = lines.findIndex((l) => l.includes('-->'))
    if (at < 0) continue
    const [a, b] = lines[at].split('-->').map((s) => ts(s.trim()))
    cues.push({ start: a, end: b, text: lines.slice(at + 1).join(' ') })
  }
  return cues
}

// Clip schedule per segment: [clip, start-in-clip (s), seconds on screen or 'rest'].
// Highlights: at = seconds into the segment, or { cue: n, plus } for "n-th sentence starts".
const SEGMENTS = [
  {
    id: 's01-hook',
    clips: [['k01-balance', 0.5, 'rest']],
    zoom: { x: 380, y: 330, scale: 1.45, at: 0.3, out: null },
    highlights: [{ at: 0.9, x: 120, y: 305, w: 270, h: 110, label: 'Available balance' }],
  },
  {
    id: 's02-problem',
    clips: [['k02-problem', 8.5, 'rest']],
    highlights: [
      { at: { cue: 0, plus: 0.2 }, x: 84, y: 305, w: 960, h: 155, label: 'Fee and payment: one balance' },
      { at: { cue: 2, plus: 0.2 }, x: 84, y: 478, w: 990, h: 40, kind: 'underline' },
    ],
  },
  {
    id: 's03-promise',
    clips: [['k03-hero', 0, 'rest']],
    highlights: [{ at: 0.8, x: 84, y: 280, w: 870, h: 410 }],
  },
  {
    id: 's04-app',
    clips: [['k04-recipient', 1, 'rest']],
    highlights: [
      { at: { cue: 0, plus: 0.4 }, x: 1264, y: 12, w: 166, h: 60, label: 'Arc mainnet · real USDC', labelBelow: true },
      { at: { cue: 1, plus: 0.3 }, x: 1580, y: 12, w: 228, h: 60, label: 'Connected with MetaMask', labelBelow: true },
      { at: { cue: 1, plus: 2.2 }, x: 120, y: 305, w: 270, h: 110, label: 'About three cents' },
      { at: { cue: 2, plus: 0.2 }, x: 126, y: 620, w: 754, h: 80, label: 'My other wallet' },
    ],
  },
  {
    id: 's05-quote',
    clips: [
      ['k05a-maxnative', 2.5, 3.2],
      ['k05a-maxnative', 23, 3],
      ['k05b-quoting', 3, 5.5],
      ['k05c-quote', 0, 'rest'],
    ],
    highlights: [
      { at: { cue: 2, plus: -0.3 }, x: 966, y: 222, w: 820, h: 190, label: 'Offered: everything except the fee budget' },
      { at: { cue: 2, plus: 1.6 }, x: 966, y: 445, w: 820, h: 44, label: 'Probably costs', labelOut: true },
      { at: { cue: 3, plus: 0.1 }, x: 966, y: 505, w: 820, h: 62, label: 'At most', labelOut: true },
    ],
  },
  {
    id: 's06-remaining',
    clips: [['k06-remaining', 0, 'rest']],
    highlights: [
      { at: { cue: 0, plus: 0.6 }, x: 966, y: 232, w: 820, h: 62, label: 'Stays behind', labelOut: true },
      { at: { cue: 1, plus: 0.2 }, x: 966, y: 328, w: 820, h: 62, kind: 'underline' },
    ],
  },
  {
    id: 's07-review',
    clips: [['k07-review', 4, 'rest', 1.35]],
    highlights: [
      { at: { cue: 0, plus: 0.3 }, x: 126, y: 140, w: 754, h: 80, label: 'Full recipient address' },
      { at: { cue: 0, plus: 2.0 }, x: 966, y: 290, w: 820, h: 44, label: 'Total', labelOut: true },
      { at: { cue: 1, plus: 0.2 }, x: 966, y: 600, w: 820, h: 80, label: 'Reviewed and acknowledged', labelOut: true },
    ],
  },
  {
    id: 's08-wallet',
    clips: [
      ['k08a-wallet', 0.5, 2.6],
      ['k08b-confirm', 0, 'rest'],
    ],
    badges: [{ at: 0.2, text: 'MetaMask · approved by the wallet owner' }],
  },
  {
    id: 's09-result',
    clips: [
      ['k09a-verified', 0, 5],
      ['k09b-receipt', 3, 2.6],
      ['k09c-fees', 13, 'rest'],
    ],
    highlights: [
      { at: 0.6, until: 4.5, x: 970, y: 170, w: 836, h: 300, label: 'Read from the chain receipt' },
      { at: { cue: 2, plus: 3.4 }, x: 110, y: 160, w: 880, h: 148, label: 'Exactly the reviewed amount' },
      { at: { cue: 2, plus: 5.4 }, x: 1058, y: 532, w: 728, h: 44, label: 'Actual fee', labelOut: true },
      { at: { cue: 2, plus: 7.2 }, x: 1058, y: 642, w: 728, h: 44, label: 'Inside the budget', labelOut: true },
    ],
  },
  {
    id: 's10-verify',
    clips: [
      ['k10a-explorer', 0, 5],
      ['k10b-reverify', 3.5, 'rest'],
    ],
    highlights: [
      { at: 1.0, x: 200, y: 270, w: 610, h: 50, label: 'Arc explorer' },
      { at: 2.2, until: 4.5, x: 570, y: 560, w: 140, h: 46, label: 'Success', labelRight: true },
      { at: 8.8, x: 120, y: 535, w: 668, h: 42, label: 'Re-verified live, in the browser' },
    ],
  },
  {
    id: 's11-close',
    clips: [['k11-developers', 0, 'rest']],
    highlights: [
      { at: { cue: 0, plus: 0.9 }, x: 336, y: 696, w: 166, h: 68, label: 'Open source', labelBelow: true },
      { at: { cue: 0, plus: 2.6 }, until: 9, x: 88, y: 492, w: 830, h: 170, label: 'TypeScript SDK' },
    ],
  },
]

const narration = JSON.parse(readFileSync(join(root, 'src/narration.json'), 'utf8'))
const plan = { fps: FPS, width: 1920, height: 1080, segments: [], captions: [] }
let t = 0

for (const seg of SEGMENTS) {
  const audioFile = `public/audio/vo/${seg.id}.mp3`
  const audio = probe(audioFile)
  const isLast = seg === SEGMENTS[SEGMENTS.length - 1]
  const dur = LEAD + audio + TAIL
  const cues = cuesFor(seg.id)
  const at = (v) => (typeof v === 'number' ? v : LEAD + cues[v.cue].start + (v.plus ?? 0))

  // Lay clips end to end; 'rest' fills the remaining time, slowing the clip if it is too short.
  const clips = []
  let c = 0
  for (const [name, from, len, rate = 1] of seg.clips) {
    const available = probe(`public/clips/${name}.mp4`) - from
    const span = len === 'rest' ? dur - c : len
    const needed = span * rate
    clips.push({ src: `clips/${name}.mp4`, from, start: c, dur: span, rate: needed > available ? available / span : rate })
    c += span
  }
  if (c > dur + 0.01) throw new Error(`${seg.id}: clips run ${c.toFixed(2)}s, segment is ${dur.toFixed(2)}s`)

  plan.segments.push({
    id: seg.id,
    start: t,
    dur,
    audio: { src: `audio/vo/${seg.id}.mp3`, at: LEAD },
    clips,
    zoom: seg.zoom ?? null,
    highlights: (seg.highlights ?? []).map((h) => ({ ...h, at: at(h.at), until: h.until ?? null })),
    badges: (seg.badges ?? []).map((b) => ({ ...b, at: at(b.at) })),
  })

  // Captions: one cue per sentence, long sentences split at a comma near the middle.
  const caption = narration.find((n) => n.id === seg.id).caption
  for (const cue of cues) {
    const parts = splitLine(cue.text)
    const total = parts.reduce((s, p) => s + p.length, 0)
    let s = cue.start
    for (const p of parts) {
      const d = ((cue.end - cue.start) * p.length) / total
      plan.captions.push({ start: t + LEAD + s, end: t + LEAD + s + d, text: p })
      s += d
    }
  }
  if (!caption) throw new Error(`no caption for ${seg.id}`)
  t += dur
  if (isLast) {
    plan.endCard = { start: t, dur: END_CARD }
    t += END_CARD
  }
}
plan.duration = t

function splitLine(text, max = 64) {
  if (text.length <= max) return [text]
  const mid = text.length / 2
  let best = -1
  for (let i = 0; i < text.length; i++) if (text[i] === ',' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  if (best < 0) {
    for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  }
  return [...splitLine(text.slice(0, best + 1).trim(), max), ...splitLine(text.slice(best + 1).trim(), max)]
}

const stamp = (s, sep) => {
  const ms = Math.round(s * 1000)
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`
}
mkdirSync(join(root, 'out'), { recursive: true })
writeFileSync(join(root, 'src/plan.json'), JSON.stringify(plan, null, 2) + '\n')
writeFileSync(
  join(root, 'out/lastdollar-demo.srt'),
  plan.captions.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'),
)
writeFileSync(
  join(root, 'out/lastdollar-demo.vtt'),
  'WEBVTT\n\n' + plan.captions.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n'),
)
console.log(`plan: ${plan.segments.length} segments, ${plan.captions.length} captions, ${t.toFixed(2)}s`)
