import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { docBlurbs, docs } from '@/lib/docs'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Documentation',
  description: 'LastDollar SDK, payment math, security model and Arc network verification.',
  path: '/docs',
})

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
              <p className="mt-1 text-sm text-muted">{docBlurbs[d.slug] ?? ''}</p>
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
