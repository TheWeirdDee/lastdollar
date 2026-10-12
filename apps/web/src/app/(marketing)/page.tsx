import {
  ArrowRight,
  BadgeCheck,
  CircleSlash,
  Equal,
  FileCheck2,
  KeyRound,
  Layers,
  ListChecks,
  RefreshCcw,
  ScanSearch,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { CodeBlock } from '@/components/code'
import { QuoteSummary, type QuoteView } from '@/components/quote-summary'
import { Reveal } from '@/components/site'
import { Badge, ButtonLink, Card } from '@/components/ui'
import { hasMainnetEvidence, mainnetEntries } from '@/lib/evidence'
import { shortHash, txUrl, usd } from '@/lib/format'
import { quickstartSnippet } from '@/lib/snippets'

const U = 10n ** 18n
// Illustrative figures for the preview. Fee values match observed Arc mainnet costs for an
// ERC-20 transfer at the 20 gwei base fee; the payment itself is not real.
const sample: QuoteView = {
  kind: 'exact',
  mode: 'erc20',
  recipients: [{ address: '0x2401f72D90E19daD3d0c3e45b906C760507791E8', amount18: 250n * U }],
  recipientTotal18: 250n * U,
  estimatedFee18: 986_520_000_000_000n,
  maxFeeBudget18: 1_406_475_000_000_000n,
  maxDebit18: 250n * U + 1_406_475_000_000_000n,
  balance18: 312_420_000_000_000_000_000n,
  estimatedRemaining18: 312_420_000_000_000_000_000n - 250n * U - 986_520_000_000_000n,
  minimumRemaining18: 312_420_000_000_000_000_000n - 250n * U - 1_406_475_000_000_000n,
  status: 'ready',
}

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Why is the network fee paid in USDC?',
    a: 'Arc uses USDC as its native gas token. The money you send and the fee for sending it come out of the same balance, so they have to be planned together.',
  },
  {
    q: 'Why does send-max leave a small remainder?',
    a: 'LastDollar reserves a maximum fee budget before calculating the amount, because the exact fee is only known after execution. The part of the budget the network does not charge stays in your wallet. In ERC-20 mode, any balance below one micro-USDC also stays, because the 6-decimal interface cannot move it. Send-max never promises an empty wallet.',
  },
  {
    q: 'What is the difference between native and ERC-20 mode?',
    a: 'Both move the same USDC. Native mode sends the value directly with 18-decimal precision. ERC-20 mode calls the USDC token contract with 6-decimal precision, which some recipients and accounting tools expect. Native mode is slightly cheaper; ERC-20 mode is the most widely understood by other applications.',
  },
  {
    q: 'Why can a quote change before I sign?',
    a: 'A quote depends on your balance, your account nonce and current fees. LastDollar rechecks all of them immediately before your wallet opens. If the amount, the recipients or the maximum debit would change, you are shown the difference and asked to review again.',
  },
  {
    q: 'Do failed transactions cost anything?',
    a: 'Yes. If a transaction is included in a block and then reverts, the network still charges for the gas it used. LastDollar simulates every transaction with its final fee caps before you sign to catch failures early, but a simulation cannot guarantee the outcome.',
  },
  {
    q: 'What does atomic batching guarantee?',
    a: 'A batch is one transaction to the LastDollar splitter contract. Either every recipient is paid exactly their amount, or the whole transaction reverts and nobody is paid. It does not protect against paying the wrong address, and a reverted batch still costs gas.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-60 [background:radial-gradient(60%_60%_at_70%_30%,var(--accent-soft),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.2fr_0.9fr] lg:gap-14 lg:px-8 lg:pb-28">
          <div>
            <Badge tone="accent">USDC payments on Arc</Badge>
            <h1 className="display mt-5 text-[clamp(2.35rem,5.4vw,4rem)]">
              Send exactly what you intend.
              <span className="block text-muted">Know what it costs.</span>
              <span className="block">Verify what arrived.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
              LastDollar quotes the recipient amount and the network fee together, rechecks before your wallet signs, and confirms the result from the chain receipt.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/app" size="lg">
                Open app <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/proof" size="lg" variant="secondary">
                View mainnet proof
              </ButtonLink>
            </div>
          </div>
          <div className="relative">
            <QuoteSummary view={sample} sampleLabel="Illustrative sample" className="mx-auto max-w-md" />
            <p className="mx-auto mt-3 max-w-md text-center text-xs text-muted">The real review screen, rendered with sample values. No payment is shown here.</p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface">
        <Reveal className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">The problem</p>
            <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">On Arc, the money and the gas are the same USDC.</h2>
            <p className="mt-4 text-muted">
              A wallet that tries to send its whole token balance leaves nothing for the fee. The same funds appear as 18 decimals natively and 6 decimals through the token
              interface, so comparing them directly gives wrong answers by a factor of a trillion.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center gap-2 text-danger">
                <CircleSlash className="size-5" aria-hidden />
                <h3 className="font-semibold">Naive send-max</h3>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-muted">
                <li>1. Read the ERC-20 balance.</li>
                <li>2. Transfer all of it.</li>
                <li>3. The balance no longer covers the fee. On Arc mainnet the node rejects a full-balance native send outright.</li>
              </ol>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-2 text-success">
                <Equal className="size-5" aria-hidden />
                <h3 className="font-semibold">Fee-aware send-max</h3>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-muted">
                <li>1. Read the native balance at one block.</li>
                <li>2. Estimate the real call and reserve a bounded fee budget.</li>
                <li>3. Send the remainder, rounded down to what the interface can represent.</li>
              </ol>
            </Card>
          </div>
          <p className="mt-6 text-sm text-muted">
            Developers who handle this carefully can build it themselves with viem. LastDollar packages the whole lifecycle around it: estimates, caps, rechecks, typed errors and
            receipt reconciliation. <Link className="text-accent underline underline-offset-4" href="/docs/payment-math">Read the math</Link>.
          </p>
        </Reveal>
      </section>

      {/* Capabilities */}
      <section id="product" className="scroll-mt-20">
        <Reveal className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <p className="eyebrow">What it does</p>
          <h2 className="mt-2 max-w-2xl text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">Three payments, each with its full cost shown before you sign.</h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: Send,
                title: 'Exact payments',
                body: 'The recipient gets precisely the amount you enter. You see the estimated fee, the maximum fee budget and the most your balance can drop.',
                points: ['Native or ERC-20 USDC', 'Blocks unaffordable payments before signing', 'Rejects precision the token cannot carry'],
              },
              {
                icon: Wallet,
                title: 'Send maximum',
                body: 'Sends everything that fits after a bounded fee reserve, calculated from the native balance rather than the truncated token view.',
                points: ['Estimate, compute, re-estimate, simulate', 'Rounded down, never up', 'Shows the expected remainder honestly'],
              },
              {
                icon: Layers,
                title: 'Atomic native batches',
                body: 'Pay up to 200 recipients in one transaction through an open-source splitter contract. Native USDC means no token approval step.',
                points: ['All recipients paid, or none', 'CSV import with row-level errors', 'Per-recipient settlement evidence'],
              },
            ].map(({ icon: Icon, title, body, points }) => (
              <Card key={title} className="flex flex-col p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Lifecycle */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface">
        <Reveal className="mx-auto grid max-w-[1200px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">Quote, recheck, sign, verify.</h2>
            <p className="mt-4 max-w-md text-muted">Every payment follows the same four steps, in the app and in the SDK. A payment is only shown as complete when the chain receipt says so.</p>
          </div>
          <ol className="relative space-y-8 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-border">
            {[
              { icon: ScanSearch, t: 'Quote', d: 'Read your balance at a single block, estimate the exact call, and separate the estimated fee from the maximum fee budget.' },
              { icon: RefreshCcw, t: 'Review and recheck', d: 'You review every recipient and amount. Right before signing, the balance, nonce and fees are checked again; changed terms send you back to review.' },
              { icon: KeyRound, t: 'Sign', d: 'Your wallet shows the transaction and you approve it. LastDollar never holds keys, never switches networks for you, and never signs on its own.' },
              { icon: FileCheck2, t: 'Verify', d: 'The receipt is read from the chain, transfer logs are reconciled against what you approved, and the actual fee is compared with the budget.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="relative flex gap-5">
                <span className="relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-accent">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="pt-1.5">
                  <h3 className="font-semibold">
                    <span className="mr-2 text-muted tabular">{i + 1}.</span>
                    {t}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Developers */}
      <section id="developers" className="scroll-mt-20">
        <Reveal className="mx-auto grid max-w-[1200px] items-start gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
          <div>
            <p className="eyebrow">For developers</p>
            <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">The same engine, as a TypeScript SDK.</h2>
            <p className="mt-4 text-muted">
              <span className="font-mono text-sm text-text">@lastdollar/arc</span> works with any viem public and wallet client. No React, no backend, no account. Typed quotes, plans,
              receipts and error codes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/developers" variant="primary">
                Developer guide
              </ButtonLink>
              <ButtonLink href="/docs/sdk" variant="secondary">
                API reference
              </ButtonLink>
            </div>
          </div>
          <CodeBlock code={quickstartSnippet} title="quickstart.ts" className="min-w-0" />
        </Reveal>
      </section>

      {/* Proof */}
      <section className="border-y border-border bg-surface">
        <Reveal className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow">Proof</p>
              <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">Claims you can check on chain.</h2>
              <p className="mt-4 text-muted">
                {hasMainnetEvidence
                  ? 'Mainnet capabilities are backed by real Arc mainnet transactions, verified on two independent RPC providers.'
                  : 'Mainnet proofs are listed here only once they exist on chain and verify on two independent RPC providers.'}{' '}
                Simulations and unit tests are labelled as such.
              </p>
            </div>
            <ButtonLink href="/proof" variant="secondary">
              Open the proof page <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
          {hasMainnetEvidence ? (
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mainnetEntries.map((e) => (
                <li key={e.id}>
                  <Card className="h-full p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="success" icon={<BadgeCheck className="size-3" aria-hidden />}>
                        Mainnet, verified
                      </Badge>
                      <span className="text-xs text-muted">{e.mode === 'native' ? 'Native' : 'ERC-20'}</span>
                    </div>
                    <p className="mt-3 font-medium">{e.label}</p>
                    <p className="mt-1 text-sm text-muted tabular">Actual fee {usd(e.actual.fee18)} USDC</p>
                    <a href={txUrl(e.hash)} className="mt-3 inline-block font-mono text-xs text-accent underline underline-offset-4">
                      {shortHash(e.hash)}
                    </a>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="mt-10 flex items-start gap-3 p-6">
              <ListChecks className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="font-medium">Mainnet evidence not yet recorded</p>
                <p className="mt-1 text-sm text-muted">The proof page shows the verified network configuration and the test results today. Transaction proofs appear here only once they exist on chain.</p>
              </div>
            </Card>
          )}
        </Reveal>
      </section>

      {/* Ownership */}
      <section>
        <Reveal className="mx-auto grid max-w-[1200px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <p className="eyebrow">Your keys, your signature</p>
            <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">LastDollar prepares. Your wallet decides.</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: KeyRound, t: 'No keys, no custody', d: 'There is no LastDollar account or server holding funds. The splitter contract forwards value in the same transaction and keeps nothing.' },
              { icon: ShieldCheck, t: 'One signature per payment', d: 'Connecting or reconnecting never signs. Each payment opens your wallet once, after you review it.' },
              { icon: RefreshCcw, t: 'No silent changes', d: 'If the reviewed terms change, the app stops and shows you what changed.' },
              { icon: ScanSearch, t: 'Local-only history', d: 'Payment references are stored in this browser. Status always comes from the chain.' },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="rounded-2xl border border-border p-5">
                <Icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border bg-surface">
        <Reveal className="mx-auto max-w-[860px] px-4 py-20 sm:px-6 lg:py-24">
          <p className="eyebrow">Questions</p>
          <h2 className="mt-2 text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">Before you send</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-xl leading-none text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-text px-6 py-14 text-center text-bg sm:px-12">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em]">See the whole cost before your next payment.</h2>
            <p className="mx-auto mt-4 max-w-lg text-bg/70">Connect a wallet on Arc mainnet, or explore the proof page without one.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/app" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-bg px-5 font-medium text-text transition-opacity hover:opacity-90">
                Open app <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/docs" className="inline-flex h-12 items-center justify-center rounded-xl border border-bg/25 px-5 font-medium text-bg transition-colors hover:bg-bg/10">
                Read the docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
