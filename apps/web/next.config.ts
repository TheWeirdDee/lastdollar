import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// pnpm workspace root, so Turbopack resolves hoisted and symlinked packages.
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const extraConnect = process.env.NEXT_PUBLIC_ARC_RPC_URL ? ` ${new URL(process.env.NEXT_PUBLIC_ARC_RPC_URL).origin}` : ''

// Wallets inject providers into the page and talk to their own extension; the page itself only
// needs to reach Arc RPC endpoints. Inline scripts are required for the no-flash theme script.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.arc.io wss://*.arc.io${extraConnect}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets the proof page name the exact commit it was built from (set by Vercel's git integration).
  env: { NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? '' },
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      {
        // Wallet state, balances and receipts are always fetched live in the browser.
        source: '/app/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
