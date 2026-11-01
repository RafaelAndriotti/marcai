import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

export interface Kpi {
  label: string
  /** undefined enquanto carrega; null quando o dado não existe (vira "–"). */
  value: string | null | undefined
  /** Linha de 12px que nomeia a base da conta. */
  caption: string
  /** Faixa opcional sob o valor (progresso). */
  extra?: ReactNode
}

/** Um contêiner dividido por linhas de 1px (gap de 1px sobre fundo de linha). Sem ícones. */
export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4"
    >
      {items.map((k) => (
        <div key={k.label} className="flex flex-col bg-surface px-5 py-4">
          <p className="text-sm text-muted">{k.label}</p>
          {k.value === undefined ? (
            <Skeleton className="mt-1.5 h-6 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-semibold leading-8 tracking-tight">
              {k.value ?? <span className="text-muted">–</span>}
            </p>
          )}
          {k.extra}
          <p className="mt-1 text-xs text-muted">{k.caption}</p>
        </div>
      ))}
    </section>
  )
}
