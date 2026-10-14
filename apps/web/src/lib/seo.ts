import type { Metadata } from 'next'

export const SITE_NAME = 'LastDollar'
const IMAGE = { width: 1200, height: 630, alt: 'LastDollar: send exactly what you intend on Arc' }

/**
 * Per-page metadata. Next merges `openGraph` and `twitter` shallowly, so a page that only set
 * `title` would keep the home page's social title; this sets them together. A page-level
 * `openGraph` also drops the image inherited from the root, so the root image routes are named here.
 */
export function pageMetadata({ title, description, path, index = true }: { title: string; description: string; path: string; index?: boolean }): Metadata {
  const social = `${title} · ${SITE_NAME}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, url: path, title: social, description, images: [{ url: '/opengraph-image', ...IMAGE }] },
    twitter: { card: 'summary_large_image', title: social, description, images: [{ url: '/twitter-image', ...IMAGE }] },
    ...(index ? {} : { robots: { index: false, follow: false } }),
  }
}
