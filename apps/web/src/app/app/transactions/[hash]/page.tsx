import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isHash } from 'viem'
import { ReceiptView } from './receipt-view'

export const metadata: Metadata = { title: 'Receipt' }

export default async function ReceiptPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  if (!isHash(hash)) notFound()
  return <ReceiptView hash={hash} />
}
