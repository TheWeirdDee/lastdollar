import { Loader2 } from 'lucide-react'

export default function AppLoading() {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
    </div>
  )
}
