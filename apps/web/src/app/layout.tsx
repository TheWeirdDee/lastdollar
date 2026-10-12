import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { ThemeProvider } from '@/components/theme'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lastdollar.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'LastDollar: Arc-aware USDC payments', template: '%s · LastDollar' },
  description:
    'Send exactly what you intend. Know what it costs. Verify what arrived. Fee-aware USDC payments, send-max and atomic batches on Arc, with an open-source SDK.',
  applicationName: 'LastDollar',
  openGraph: {
    type: 'website',
    siteName: 'LastDollar',
    title: 'LastDollar: Arc-aware USDC payments',
    description: 'Quote the full cost, recheck before signing, verify what arrived. Open source, on Arc mainnet.',
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d0f' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-soft"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
