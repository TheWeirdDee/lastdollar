import type { Metadata } from 'next'
import { Mark } from '@/components/brand'
import { ButtonLink } from '@/components/ui'

export const metadata: Metadata = { title: 'Not found', robots: { index: false, follow: false } }

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center px-4 py-16">
      <Mark className="size-10" />
      <p className="mt-8 font-mono text-sm text-muted">404</p>
      <h1 className="display mt-2 text-4xl">Nothing at this address.</h1>
      <p className="mt-4 text-muted">The page does not exist. If you followed a receipt link, check that the transaction hash is complete.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/app" variant="secondary">
          Open app
        </ButtonLink>
        <ButtonLink href="/docs" variant="ghost">
          Docs
        </ButtonLink>
      </div>
    </main>
  )
}
