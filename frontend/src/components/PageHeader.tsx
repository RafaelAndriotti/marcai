import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Uma frase cinza sobre os dados (o achado do dia, a contagem), nunca sobre a interface. */
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
