import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { WalletProviders } from '@/components/providers'

export const metadata: Metadata = {
  title: { default: 'App', template: '%s · LastDollar' },
  robots: { index: false },
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProviders>
      <AppShell>{children}</AppShell>
    </WalletProviders>
  )
}
