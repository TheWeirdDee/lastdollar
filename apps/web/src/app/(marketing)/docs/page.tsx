import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { docs } from '@/lib/docs'

export const metadata: Metadata = { title: 'Documentation', description: 'LastDollar SDK, payment math, security model and Arc network verification.' }

const blurbs: Record<string, string> = {
  sdk: 'Install, configure, and use every SDK function. Units, errors, wallet behaviour.',
  'payment-math': 'The integer arithmetic behind affordability, send-max, fee budgets and rounding.',
  security: 'Trust boundaries, threat model, contract properties and known limitations.',
  'network-verification': 'Each Arc mainnet fact, where it came from, and how it was checked live.',
  'mainnet-proof': 'How mainnet evidence is produced, verified and re-checked.',
  testing: 'Unit, contract, integration and browser test layers, and how to run them.',
  deployment: 'Deploying the web app and the splitter contract.',
  'design-direction': 'Reference research and the visual system behind the interface.',
}

export default function DocsIndex() {
  return (
    <div>
      <p className="eyebrow">Documentation</p>
      <h1 className="display mt-2 text-[clamp(2rem,4.5vw,3rem)]">LastDollar docs</h1>
      <p className="mt-4 max-w-2xl text-muted">Everything here is the same Markdown that lives in the repository&apos;s docs directory, so the site and the source cannot drift apart.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <li key={d.slug}>
            <Link href={`/docs/${d.slug}`} className="group block h-full rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
              <p className="font-semibold">{d.title}</p>
              <p className="mt-1 text-sm text-muted">{blurbs[d.slug] ?? ''}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
