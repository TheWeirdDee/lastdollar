import type { Metadata } from 'next'
import { BatchView } from './batch-view'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Batch',
  description: 'Pay several recipients in one atomic Arc transaction, with each payout checked against the receipt.',
  path: '/app/batch',
  index: false,
})

export default function BatchPage() {
  return <BatchView />
}
