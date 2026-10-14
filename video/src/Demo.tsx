import type { CSSProperties } from 'react'
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import plan from './plan.json'

// Footage is the browser viewport cropped to 1920x826, placed on a 1920x1080 canvas.
const CLIP_W = 1920
const CLIP_H = 826
const SCALE = 1792 / CLIP_W
const FRAME_W = CLIP_W * SCALE
const FRAME_H = CLIP_H * SCALE

export const C = {
  bg: '#0b1020',
  bg2: '#141b33',
  accent: '#3b5bff',
  mark: '#ffb020',
  text: '#f5f7ff',
  muted: '#a9b3d6',
}
const FONT = '"Segoe UI", Inter, system-ui, sans-serif'

type Highlight = (typeof plan.segments)[number]['highlights'][number] & {
  kind?: string
  label?: string
  labelBelow?: boolean
  labelRight?: boolean
  labelLeft?: boolean
  labelOut?: boolean
}
type Segment = (typeof plan.segments)[number]

export const Demo = ({ captions }: { captions: boolean }) => {
  const { fps } = useVideoConfig()
  const f = (s: number) => Math.round(s * fps)
  const top = captions ? 34 : (1080 - FRAME_H) / 2
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.bg2}, ${C.bg})`, fontFamily: FONT }}>
      {plan.segments.map((seg) => (
        <Sequence key={seg.id} from={f(seg.start)} durationInFrames={f(seg.dur)} name={seg.id}>
          <SegmentView seg={seg} top={top} />
        </Sequence>
      ))}
      {plan.endCard ? (
        <Sequence from={f(plan.endCard.start) - f(0.6)} durationInFrames={f(plan.endCard.dur) + f(0.6)} name="end-card">
          <EndCard />
        </Sequence>
      ) : null}
      {captions ? <Captions top={top + FRAME_H + 26} /> : null}
    </AbsoluteFill>
  )
}

const SegmentView = ({ seg, top }: { seg: Segment; top: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = (s: number) => Math.round(s * fps)
  const t = frame / fps
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  // Optional slow push-in toward a point of interest.
  let zoom = 1
  let ox = CLIP_W / 2
  let oy = CLIP_H / 2
  if (seg.zoom) {
    zoom = interpolate(t, [seg.zoom.at, seg.zoom.at + 1.6], [1, seg.zoom.scale], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
    ox = seg.zoom.x
    oy = seg.zoom.y
  }

  const hs = seg.highlights as Highlight[]
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <Sequence from={f(seg.audio.at)} layout="none">
        <Audio src={staticFile(seg.audio.src)} />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: (1920 - FRAME_W) / 2,
          top,
          width: FRAME_W,
          height: FRAME_H,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
          background: '#fff',
        }}
      >
        <div style={{ width: CLIP_W, height: CLIP_H, transform: `scale(${SCALE})`, transformOrigin: '0 0' }}>
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${ox}px ${oy}px` }}>
            {seg.clips.map((c, i) => (
              <Sequence key={i} from={f(c.start)} durationInFrames={Math.max(1, f(c.dur))} layout="none">
                <OffthreadVideo
                  src={staticFile(c.src)}
                  startFrom={f(c.from)}
                  playbackRate={c.rate}
                  muted
                  style={{ position: 'absolute', inset: 0, width: CLIP_W, height: CLIP_H }}
                />
              </Sequence>
            ))}
            {hs.map((h, i) => {
              const next = hs.slice(i + 1).find((n) => n.at > h.at)
              const end = h.until ?? Math.min(next ? next.at : seg.dur, h.at + 4.6, seg.dur - 0.15)
              return <Mark key={i} h={h} t={t} end={end} />
            })}
          </div>
        </div>
      </div>
      {seg.badges.map((b, i) => (
        <Badge key={i} text={b.text} t={t - b.at} top={top} />
      ))}
    </AbsoluteFill>
  )
}

const Mark = ({ h, t, end }: { h: Highlight; t: number; end: number }) => {
  if (t < h.at - 0.05 || t > end + 0.4) return null
  const p = interpolate(t, [h.at, h.at + 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const out = interpolate(t, [end, end + 0.35], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pad = 8
  const x = h.x - pad
  const y = h.y - pad
  const w = h.w + pad * 2
  const hh = h.h + pad * 2
  const perim = 2 * (w + hh)
  const underline = h.kind === 'underline'
  const labelStyle: CSSProperties = {
    position: 'absolute',
    whiteSpace: 'nowrap',
    background: C.mark,
    color: '#1a1200',
    fontWeight: 700,
    fontSize: 30,
    padding: '8px 18px',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    opacity: interpolate(t, [h.at + 0.3, h.at + 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(t, [h.at + 0.3, h.at + 0.6], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
  }
  if (h.labelOut) Object.assign(labelStyle, { top: y + hh / 2 - 27, right: CLIP_W - x + 14 })
  else if (h.labelBelow) Object.assign(labelStyle, { top: y + hh + 12, right: CLIP_W - (x + w) })
  else if (h.labelRight) Object.assign(labelStyle, { top: y - 58, right: CLIP_W - (x + w) })
  else if (h.labelLeft) Object.assign(labelStyle, { top: y - 58, left: x })
  else Object.assign(labelStyle, { top: Math.max(4, y - 58), left: x })
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out, pointerEvents: 'none' }}>
      <svg width={CLIP_W} height={CLIP_H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {underline ? (
          <line x1={h.x} y1={h.y + h.h + 6} x2={h.x + h.w * p} y2={h.y + h.h + 6} stroke={C.mark} strokeWidth={7} strokeLinecap="round" />
        ) : (
          <>
            <rect x={x} y={y} width={w} height={hh} rx={14} fill={`rgba(255,176,32,${0.1 * p})`} />
            <rect
              x={x}
              y={y}
              width={w}
              height={hh}
              rx={14}
              fill="none"
              stroke={C.mark}
              strokeWidth={6}
              strokeDasharray={perim}
              strokeDashoffset={perim * (1 - p)}
              style={{ filter: 'drop-shadow(0 0 10px rgba(255,176,32,0.55))' }}
            />
          </>
        )}
      </svg>
      {h.label ? <div style={labelStyle}>{h.label}</div> : null}
    </div>
  )
}

const Badge = ({ text, t, top }: { text: string; t: number; top: number }) => {
  if (t < 0) return null
  const o = interpolate(t, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        top: top + 30,
        opacity: o,
        background: 'rgba(11,16,32,0.88)',
        color: C.text,
        fontSize: 30,
        fontWeight: 600,
        padding: '12px 22px',
        borderRadius: 14,
        border: `2px solid ${C.mark}`,
      }}
    >
      {text}
    </div>
  )
}

const Captions = ({ top }: { top: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  const cue = plan.captions.find((c) => t >= c.start && t < c.end + 0.15)
  if (!cue) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1600, color: C.text, fontSize: 40, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
        {cue.text}
      </div>
    </div>
  )
}

export const Logo = ({ size = 72 }: { size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: C.accent,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: size * 0.6,
    }}
  >
    L
  </div>
)

const EndCard = () => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.bg2}, ${C.bg})`, opacity: o, alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Logo size={110} />
        <div style={{ color: C.text, fontSize: 104, fontWeight: 800, letterSpacing: -2 }}>LastDollar</div>
      </div>
      <div style={{ color: C.muted, fontSize: 40, marginTop: 28 }}>Send exactly what you intend. Know what it costs. Verify what arrived.</div>
      <div style={{ color: C.text, fontSize: 52, fontWeight: 700, marginTop: 70 }}>lastdollar.vercel.app</div>
      <div style={{ color: C.muted, fontSize: 36, marginTop: 18 }}>github.com/TheWeirdDee/lastdollar</div>
      <div style={{ color: C.mark, fontSize: 30, marginTop: 50, fontWeight: 600 }}>Filmed on Arc mainnet with real USDC</div>
    </AbsoluteFill>
  )
}
