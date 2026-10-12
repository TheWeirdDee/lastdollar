import { DocsNav } from './docs-nav'
import { docs } from '@/lib/docs'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:px-8">
      <DocsNav docs={docs.map(({ slug, title }) => ({ slug, title }))} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
