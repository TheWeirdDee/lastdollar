import type { Metadata } from 'next'
import { SendView } from './send-view'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Send',
  description: 'Send an exact amount or the maximum in USDC on Arc, with the fee quoted, rechecked before signing and verified after.',
  path: '/app/send',
  index: false,
})

export default function SendPage() {
  return <SendView />
}
