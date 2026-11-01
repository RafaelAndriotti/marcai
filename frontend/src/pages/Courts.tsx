import { LayoutGrid } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { SportBadge } from '../components/SportBadge'
import { Spinner } from '../components/Spinner'
import { useFetch } from '../hooks/useFetch'
import { formatBRL } from '../lib/format'
import { getCourts } from '../services/api'

export function Courts() {
  const { data, error, loading, refetch } = useFetch(getCourts, [])

  return (
    <>
      <PageHeader title="Quadras" description="Quadras cadastradas na arena" />
      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState icon={LayoutGrid} title="Nenhuma quadra cadastrada" />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <li key={c.id} className={`card p-5 ${c.active ? '' : 'opacity-75'}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold">{c.name}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    c.active ? 'bg-primary-soft text-primary-soft-fg' : 'bg-neutral-soft text-neutral-fg'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${c.active ? 'bg-primary' : 'bg-muted'}`}
                    aria-hidden="true"
                  />
                  {c.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className="mt-2">
                <SportBadge sport={c.sport} />
              </div>
              <p className="mt-5 text-2xl font-bold tabular-nums">
                {formatBRL(c.pricePerHour)}
                <span className="ml-1 text-sm font-medium text-muted">/ hora</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
