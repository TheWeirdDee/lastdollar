'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, background: '#f6f6f3', color: '#15150f' }}>
        <h1 style={{ fontSize: 22 }}>LastDollar could not load</h1>
        <p style={{ maxWidth: 520, lineHeight: 1.6 }}>Nothing is sent when a page fails to render. Reload to try again.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: '10px 16px', borderRadius: 10, border: 0, background: '#2346cf', color: '#fff' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
