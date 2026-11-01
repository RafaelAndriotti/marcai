import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  description?: string
  icon?: LucideIcon
}

/** Uma frase dentro de uma caixa tracejada, no quadro do bloco que ficou vazio. */
export function EmptyState({ title, description, icon: Icon }: Props) {
  return (
    <div className="m-4 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-control px-4 py-6 text-center">
      <p className="flex items-center gap-2 text-sm font-medium">
        {Icon && <Icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden="true" />}
        {title}
      </p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
    </div>
  )
}
