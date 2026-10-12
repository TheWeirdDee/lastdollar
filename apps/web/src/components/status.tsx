import { CheckCircle2, CircleAlert, CircleDashed, Clock, Repeat2, XCircle } from 'lucide-react'
import { Badge } from './ui'
import type { RecordStatus } from '@/lib/history'

const map: Record<RecordStatus, { tone: 'success' | 'danger' | 'warning' | 'neutral' | 'accent'; label: string; Icon: typeof CheckCircle2 }> = {
  verified: { tone: 'success', label: 'Verified', Icon: CheckCircle2 },
  pending: { tone: 'accent', label: 'Pending', Icon: Clock },
  reverted: { tone: 'danger', label: 'Reverted', Icon: XCircle },
  mismatch: { tone: 'danger', label: 'Mismatch', Icon: CircleAlert },
  replaced: { tone: 'warning', label: 'Replaced', Icon: Repeat2 },
  unresolved: { tone: 'warning', label: 'Unresolved', Icon: CircleDashed },
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  const s = map[status]
  return (
    <Badge tone={s.tone} icon={<s.Icon className="size-3" aria-hidden />}>
      {s.label}
    </Badge>
  )
}
