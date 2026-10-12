'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button, Card } from '@/components/ui'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-8 max-w-lg p-6" role="alert">
      <AlertTriangle className="size-6 text-warning" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">This screen hit an error</h1>
      <p className="mt-2 text-sm text-muted">
        Nothing is sent when a screen fails to render. If you had already signed a payment, it is still tracked in History and its outcome comes from the chain.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted">Reference {error.digest}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/app/history" className="inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-medium text-accent hover:bg-surface-2">
          Open history
        </Link>
      </div>
    </Card>
  )
}
