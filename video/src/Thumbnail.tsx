import { AbsoluteFill, Img, staticFile } from 'remotion'
import { C, Logo } from './Demo'

// Uses a real frame from the filmed quote (public/thumb-quote.png), not a mock-up.
export const Thumbnail = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.bg2}, ${C.bg})`, fontFamily: '"Segoe UI", Inter, system-ui, sans-serif' }}>
    <Img
      src={staticFile('thumb-quote.png')}
      style={{ position: 'absolute', left: 636, top: 150, width: 610, borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
    />
    <div style={{ position: 'absolute', left: 64, top: 64, display: 'flex', alignItems: 'center', gap: 18 }}>
      <Logo size={64} />
      <div style={{ color: C.text, fontSize: 52, fontWeight: 800 }}>LastDollar</div>
    </div>
    <div style={{ position: 'absolute', left: 64, top: 190, width: 540, color: C.text, fontSize: 68, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5 }}>
      Send max, <span style={{ color: C.mark }}>when the fee</span> comes from the same USDC
    </div>
    <div style={{ position: 'absolute', left: 64, bottom: 64, color: C.muted, fontSize: 30 }}>Live demo · Arc mainnet · real USDC</div>
  </AbsoluteFill>
)
