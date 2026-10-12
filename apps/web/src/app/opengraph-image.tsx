import { ImageResponse } from 'next/og'

export const alt = 'LastDollar: send exactly what you intend on Arc'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#f6f6f3', color: '#15150f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#2346cf" />
            <path d="M10.5 8.5v14h11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="21.5" cy="11.5" r="3" fill="#fff" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>LastDollar</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>
          <span>Send exactly what you intend.</span>
          <span style={{ color: '#5d5d55' }}>Know what it costs.</span>
          <span>Verify what arrived.</span>
        </div>
        <span style={{ fontSize: 28, color: '#5d5d55' }}>USDC payments on Arc · open-source SDK and app</span>
      </div>
    ),
    size,
  )
}
