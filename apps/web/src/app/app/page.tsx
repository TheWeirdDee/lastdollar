import type { Metadata } from 'next'
import { OverviewView } from './overview-view'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Overview',
  description: 'Your USDC balance on Arc, recent payments and where to start.',
  path: '/app',
  index: false,
})

export default function AppOverviewPage() {
  return <OverviewView />
}
