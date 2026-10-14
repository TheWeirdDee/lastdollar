import type { Metadata } from 'next'
import { HistoryView } from './history-view'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'History',
  description: 'Payments made in this browser, rechecked against the chain.',
  path: '/app/history',
  index: false,
})

export default function HistoryPage() {
  return <HistoryView />
}
