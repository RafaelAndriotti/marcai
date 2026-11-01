import { CalendarCheck, DollarSign, Gauge, ReceiptText } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { SportBadge } from '../components/SportBadge'
import { Spinner } from '../components/Spinner'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, formatLongDate, formatPercent, formatTime } from '../lib/format'
import { getDashboardSummary } from '../services/api'

export function Dashboard() {
  const { data, error, loading, refetch } = useFetch(() => getDashboardSummary(), [])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={data ? formatLongDate(data.date) : 'Resumo do dia'}
      />
      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <>
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Reservas do dia" value={String(data.bookingsCount)} icon={CalendarCheck} />
            <StatCard label="Ocupação" value={formatPercent(data.occupancyRate)} icon={Gauge} />
            <StatCard label="Faturamento do dia" value={formatBRL(data.revenue)} icon={DollarSign} />
            <StatCard
              label="Pedidos abertos"
              value={String(data.openOrdersCount)}
              icon={ReceiptText}
            />
          </section>

          <section aria-labelledby="proximas" className="card mt-6">
            <h2 id="proximas" className="border-b border-line px-5 py-4 text-lg font-bold">
              Próximas reservas
            </h2>
            {data.upcomingBookings.length === 0 ? (
              <EmptyState
                title="Nenhuma reserva a caminho"
                description="Não há reservas futuras para hoje."
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.upcomingBookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-sm font-semibold tabular-nums">
                        {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
                      </div>
                      <div>
                        <p className="font-medium">{b.customerName}</p>
                        <p className="text-sm text-muted">{b.court?.name ?? 'Quadra'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.court && <SportBadge sport={b.court.sport} />}
                      <StatusBadge kind="booking" status={b.status} />
                      <span className="w-20 text-right text-sm font-semibold tabular-nums">
                        {formatBRL(b.price)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}
