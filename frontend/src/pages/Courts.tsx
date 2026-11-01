import { LayoutGrid } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { SportBadge } from '../components/SportBadge'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, plural, today } from '../lib/format'
import { getBookings, getCourts } from '../services/api'

const COLS = 'sm:grid-cols-[minmax(0,1fr)_9rem_7rem_8rem_6rem]'

export function Courts() {
  const day = today()
  const { data, error, loading, refetch } = useFetch(getCourts, [])
  // Reservas de hoje por quadra; se falhar, a coluna mostra "–".
  const bookings = useFetch(() => getBookings(day), [day])

  const active = data?.filter((c) => c.active).length ?? 0
  const description = data
    ? `${data.length} ${plural(data.length, 'quadra', 'quadras')}, ${active} ${plural(active, 'ativa', 'ativas')}`
    : error
      ? 'Quadras indisponíveis'
      : undefined

  return (
    <>
      <PageHeader
        title="Quadras"
        description={description ?? <Skeleton className="mt-1.5 h-4 w-40" />}
      />

      <div
        aria-hidden="true"
        className={`hidden h-9 items-center gap-4 border-b border-line px-2 text-[13px] text-muted sm:grid ${COLS}`}
      >
        <span>Quadra</span>
        <span>Esporte</span>
        <span className="text-right">Preço por hora</span>
        <span className="text-right">Reservas hoje</span>
        <span>Situação</span>
      </div>

      {loading && !data ? (
        <ul aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex h-14 items-center border-b border-line-soft px-2">
              <Skeleton className="h-4 w-48" />
            </li>
          ))}
        </ul>
      ) : error || !data ? (
        <ErrorState what="as quadras" message={error?.message} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Nenhuma quadra cadastrada" />
      ) : (
        <ul>
          {data.map((c) => {
            const todayCount = bookings.data?.filter(
              (b) => b.courtId === c.id && b.status !== 'CANCELLED',
            ).length
            return (
              <li
                key={c.id}
                className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 border-b border-line-soft px-2 py-2 hover:bg-surface-2 ${COLS} ${
                  c.active ? '' : 'text-muted'
                }`}
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="order-3 flex items-center gap-2 sm:order-none">
                  <SportBadge sport={c.sport} />
                  <span className="text-xs text-muted sm:hidden">
                    {todayCount === undefined ? '–' : todayCount} hoje
                  </span>
                </span>
                <span className="text-right sm:order-none">
                  {formatBRL(c.pricePerHour)}
                  <span className="text-xs text-muted"> /h</span>
                </span>
                <span className="hidden text-right sm:block">
                  {todayCount === undefined ? <span className="text-muted">–</span> : todayCount}
                </span>
                <span className="order-4 flex items-center gap-1.5 text-sm sm:order-none">
                  <span
                    className={`size-1.5 rounded-full ${c.active ? 'bg-primary' : 'bg-control'}`}
                    aria-hidden="true"
                  />
                  {c.active ? 'Ativa' : 'Inativa'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
