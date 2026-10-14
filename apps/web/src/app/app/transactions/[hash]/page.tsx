import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isHash } from 'viem'
import { pageMetadata } from '@/lib/seo'
import { ReceiptView } from './receipt-view'

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const { hash } = await params
  const short = isHash(hash) ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : 'transaction'
  return pageMetadata({
    title: 'Receipt',
    description: `Arc mainnet receipt for ${short}: what was delivered, the actual fee, and how it compares with the reviewed quote.`,
    path: `/app/transactions/${hash}`,
    index: false,
  })
}

export default async function ReceiptPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  if (!isHash(hash)) notFound()
  return <ReceiptView hash={hash} />
}
