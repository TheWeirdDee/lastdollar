import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { docBlurbs, docs, readDoc } from '@/lib/docs'
import { REPO_URL } from '@/lib/network'
import { pageMetadata } from '@/lib/seo'

export function generateStaticParams() {
  return docs.map((d) => ({ slug: d.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = docs.find((x) => x.slug === slug)
  if (!d) return { title: 'Docs' }
  return pageMetadata({ title: d.title, description: docBlurbs[d.slug] ?? `${d.title}: LastDollar documentation.`, path: `/docs/${d.slug}` })
}

/** Rewrites repository-relative links (e.g. "payment-math.md", "../evidence/…") for the site. */
function resolveHref(href: string | undefined): { href: string; external: boolean } {
  if (!href) return { href: '#', external: false }
  if (/^https?:\/\//.test(href)) return { href, external: true }
  if (href.startsWith('#')) return { href, external: false }
  const md = /^(?:\.\/)?([a-z0-9-]+)\.md(#.*)?$/i.exec(href)
  if (md && docs.some((d) => d.slug === md[1])) return { href: `/docs/${md[1]}${md[2] ?? ''}`, external: false }
  const clean = href.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')
  return { href: `${REPO_URL}/blob/main/${clean.startsWith('docs/') || clean.includes('/') ? clean : `docs/${clean}`}`, external: true }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await readDoc(slug)
  if (!doc) notFound()
  return (
    <article className="prose-ld">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          a: ({ href, children }) => {
            const r = resolveHref(href)
            return r.external ? (
              <a href={r.href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ) : (
              <Link href={r.href}>{children}</Link>
            )
          },
        }}
      >
        {doc.body}
      </ReactMarkdown>
      <hr />
      <p className="text-sm text-muted">
        Source:{' '}
        <a href={`${REPO_URL}/blob/main/docs/${doc.meta.file}`} target="_blank" rel="noreferrer">
          docs/{doc.meta.file}
        </a>
      </p>
    </article>
  )
}
