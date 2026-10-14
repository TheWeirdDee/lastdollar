import { ArrowRight, BookOpen, Boxes, FileCode2, Package } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CodeBlock } from '@/components/code'
import { GitHubMark } from '@/components/site'
import { ButtonLink, Card } from '@/components/ui'
import { REPO_URL, splitterDeployment } from '@/lib/network'
import { batchSnippet, maxSnippet, quickstartSnippet, receiptSnippet } from '@/lib/snippets'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Developers',
  description: 'The @lastdollar/arc SDK: quote, prepare, execute and verify USDC payments on Arc with viem.',
  path: '/developers',
})

const api = [
  ['readArcBalance', 'Native and ERC-20 views of one USDC holding at a single block'],
  ['quoteExactPayment', 'Deliver an exact amount, native or ERC-20'],
  ['quoteMaxPayment', 'Largest amount after reserving a bounded fee budget'],
  ['quoteBatchPayment', 'Atomic native batch through LastDollarSplitter'],
  ['preparePayment', 'Freeze a ready quote into the exact request to sign'],
  ['revalidatePlan', 'Recheck chain state right before signing'],
  ['executePayment', 'Revalidate, one signature, wait, reconcile'],
  ['verifyPaymentReceipt', 'Reconcile any hash from chain data'],
]

const errors = [
  'INVALID_RECIPIENT',
  'INVALID_PRECISION',
  'WRONG_CHAIN',
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_GAS_FUNDS',
  'STALE_QUOTE',
  'USER_REJECTED',
  'SIMULATION_FAILED',
  'RPC_UNAVAILABLE',
  'EXECUTION_REVERTED',
  'TRANSACTION_REPLACED',
  'RECEIPT_TIMEOUT',
  'VERIFICATION_MISMATCH',
]

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-12 sm:px-6 lg:px-8">
      <header className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Developers</p>
          <h1 className="display mt-2 text-[clamp(2.25rem,5vw,3.5rem)]">Arc payments, without re-deriving the hard parts.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            <span className="font-mono text-base text-text">@lastdollar/arc</span> is a small TypeScript library for viem. It handles Arc&apos;s shared native and ERC-20 USDC balance,
            bounded fee budgets, pre-signing rechecks, typed errors and receipt reconciliation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/docs/sdk">
              <BookOpen className="size-4" aria-hidden /> SDK reference
            </ButtonLink>
            <a href={REPO_URL} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-sm font-medium hover:border-border-strong">
              <GitHubMark className="size-4" /> Source
            </a>
          </div>
        </div>
        <CodeBlock
          title="install"
          code={`# Registry publication is pending. Build the package from source:
git clone ${REPO_URL} && cd lastdollar
pnpm install && pnpm sdk:build
cd packages/sdk && npm pack

# Then, in your project:
npm install /path/to/lastdollar-arc-0.1.0.tgz viem`}
        />
      </header>

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Quick start</h2>
        <p className="mt-1 text-sm text-muted">Quote, review, sign once, verify. Every snippet on this page is type-checked against the SDK in CI.</p>
        <CodeBlock className="mt-4" code={quickstartSnippet} title="quickstart.ts" />
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Send maximum</h3>
          <p className="mt-1 text-sm text-muted">Bounded estimate loop, then a final simulation with the exact caps.</p>
          <CodeBlock className="mt-3" code={maxSnippet} title="max.ts" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Atomic batch</h3>
          <p className="mt-1 text-sm text-muted">Strict CSV, one native transaction, no approval.</p>
          <CodeBlock className="mt-3" code={batchSnippet} title="batch.ts" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Verify any receipt</h3>
          <p className="mt-1 text-sm text-muted">Dedupes Arc&apos;s mirrored native and ERC-20 logs.</p>
          <CodeBlock className="mt-3" code={receiptSnippet} title="verify.ts" />
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 font-semibold">Public API</h2>
          <dl className="divide-y divide-border">
            {api.map(([fn, desc]) => (
              <div key={fn} className="grid gap-1 px-5 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                <dt className="font-mono text-sm">{fn}</dt>
                <dd className="text-sm text-muted">{desc}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Stable error codes</h2>
            <p className="mt-1 text-sm text-muted">Every failure is a LastDollarError with a code you can branch on. Unknown errors stay UNKNOWN; none are ever reported as success.</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {errors.map((e) => (
                <li key={e} className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[0.7rem]">
                  {e}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Contract</h2>
            <p className="mt-1 text-sm text-muted">
              LastDollarSplitter: payable, no owner, no fees, exact msg.value, reentrancy-locked, reverts the whole batch on any failed payout.
            </p>
            <p className="mt-3 font-mono text-xs break-all">{splitterDeployment.address ?? 'Mainnet deployment pending'}</p>
          </Card>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Documentation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/docs/sdk', icon: Package, t: 'SDK guide', d: 'Installation, configuration, every function and type.' },
            { href: '/docs/payment-math', icon: FileCode2, t: 'Payment math', d: 'Units, affordability, send-max and rounding.' },
            { href: '/docs/security', icon: Boxes, t: 'Security model', d: 'Trust boundaries, threats and what is not covered.' },
            { href: '/docs/network-verification', icon: BookOpen, t: 'Arc verification', d: 'Every network fact, its source and the RPC check.' },
          ].map(({ href, icon: Icon, t, d }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
              <Icon className="size-5 text-accent" aria-hidden />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Runnable Node examples (exact, max, batch, receipt) live in{' '}
          <a className="text-accent underline underline-offset-4" href={`${REPO_URL}/tree/main/examples/node`}>
            examples/node
          </a>
          , independent of this web app.
        </p>
      </section>
    </div>
  )
}
