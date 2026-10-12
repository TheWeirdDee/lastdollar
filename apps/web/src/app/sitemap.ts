import type { MetadataRoute } from 'next'
import { docs } from '@/lib/docs'

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lastdollar.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/proof', '/developers', '/docs', '/security', '/privacy', ...docs.map((d) => `/docs/${d.slug}`)]
  return pages.map((p) => ({ url: `${base}${p}` }))
}
