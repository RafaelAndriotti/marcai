import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@marcai/shared'
import { CalendarDays, Receipt } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, formatDateTime } from '../lib/format'
import { getOrders } from '../services/api'

export function Orders() {
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const { data, error, loading, refetch } = useFetch(
    () => getOrders(status || undefined),
    [status],
  )

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Pedidos do bar"
        actions={
          <>
            <label htmlFor="status-filter" className="text-sm font-medium text-muted">
              Status
            </label>
            <select
              id="status-filter"
              className="field w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
            >
              <option value="">Todos</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </>
        }
      />
      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Receipt}
            title="Nenhum pedido encontrado"
            description={status ? 'Tente outro filtro de status.' : undefined}
          />
        </div>
      ) : (
        <ul className={`grid gap-4 lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {data.map((o) => (
            <li key={o.id} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{o.customerName ?? 'Cliente não informado'}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                    <span>{formatDateTime(o.createdAt)}</span>
                    {o.bookingId && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        Reserva vinculada
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge kind="order" status={o.status} />
              </div>
              <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold tabular-nums">{i.quantity}×</span>{' '}
                      {i.productName}
                    </span>
                    <span className="tabular-nums text-muted">{formatBRL(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatBRL(o.total)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
