import { Loader2 } from 'lucide-react'

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted">
      <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
