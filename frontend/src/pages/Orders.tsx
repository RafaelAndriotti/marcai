import type { Order, OrderStatus } from '@marcai/shared'
import { CalendarDays, ChevronDown, Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { Tabs, type TabItem } from '../components/Tabs'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, formatDateTime, plural, today } from '../lib/format'
import { ApiError, getOrders, updateOrderStatus } from '../services/api'
import { NewOrderModal } from './NewOrderModal'

type Filter = 'ALL' | OrderStatus

const NOUN: Record<Filter, [string, string]> = {
  ALL: ['pedido', 'pedidos'],
  OPEN: ['pedido aberto', 'pedidos abertos'],
  PAID: ['pedido pago', 'pedidos pagos'],
  CANCELLED: ['pedido cancelado', 'pedidos cancelados'],
}

const COLS = 'sm:grid-cols-[1.5rem_minmax(0,1fr)_8rem_9rem_6rem_6.5rem]'

function summary(o: Order): string {
  return o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')
}

function Row({ o, onChanged }: { o: Order; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const detailId = `order-${o.id}`

  async function close(status: 'PAID' | 'CANCELLED') {
    if (status === 'CANCELLED' && !window.confirm('Cancelar este pedido? Não dá para desfazer.')) return
    setBusy(true)
    setError(undefined)
    try {
      await updateOrderStatus(o.id, status)
      onChanged()
    } catch (e) {
      // ORDER_NOT_OPEN: outra pessoa já fechou o pedido; recarrega para mostrar o status atual.
      if (e instanceof ApiError && e.code === 'ORDER_NOT_OPEN') onChanged()
      else setError(e instanceof ApiError ? e.message : 'Não foi possível mudar o status.')
      setBusy(false)
    }
  }
  return (
    <li className="border-b border-line-soft">
      <div
        className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-2 py-2 hover:bg-surface-2 ${COLS} min-h-14`}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={`${open ? 'Recolher' : 'Expandir'} itens do pedido de ${o.customerName ?? 'cliente sem nome'}`}
          className="row-span-2 grid size-6 place-items-center self-center rounded-lg text-muted hover:bg-surface-2 sm:row-span-1"
        >
          <ChevronDown
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
        <div className="min-w-0 leading-5">
          <p className="truncate font-medium">{o.customerName ?? 'Sem nome'}</p>
          <p className="truncate text-[13px] text-muted" title={summary(o)}>
            {summary(o)}
          </p>
        </div>
        <span className="text-right sm:order-6">{formatBRL(o.total)}</span>
        <span className="col-start-2 text-[13px] text-muted sm:col-auto sm:text-sm sm:text-fg">
          {formatDateTime(o.createdAt)}
          {o.bookingId && <span className="sm:hidden"> · Reserva vinculada</span>}
        </span>
        <span className="hidden items-center gap-1.5 text-sm sm:flex">
          {o.bookingId ? (
            <>
              <CalendarDays className="size-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
              Vinculada
            </>
          ) : (
            <span className="text-muted">–</span>
          )}
        </span>
        <span className="col-start-3 justify-self-end sm:col-auto sm:justify-self-start">
          <StatusBadge kind="order" status={o.status} />
        </span>
      </div>
      {open && (
        <div id={detailId} className="mb-2 ml-9 mr-2 rounded-lg bg-surface-2 px-3 py-1">
          <ul>
            {o.items.map((i) => (
              <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto_5rem] gap-3 py-1 text-sm">
                <span className="truncate">
                  {i.quantity}× {i.productName}
                </span>
                <span className="text-muted">{formatBRL(i.unitPrice)} cada</span>
                <span className="text-right">{formatBRL(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          {o.status === 'OPEN' && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line-soft py-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => close('PAID')}>
                Marcar pago
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => close('CANCELLED')}>
                Cancelar pedido
              </button>
              {error && (
                <p role="alert" className="text-xs text-danger-fg">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function Orders() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [date, setDate] = useState(today)
  // Busca o dia todo uma vez: as contagens das abas vêm das linhas de cada visão.
  const { data, error, loading, refetch } = useFetch(() => getOrders({ date }), [date])
  const [creating, setCreating] = useState(false)

  const count = (f: Filter) => (data ? data.filter((o) => f === 'ALL' || o.status === f).length : undefined)
  const tabs: TabItem<Filter>[] = [
    { id: 'ALL', label: 'Todos', count: count('ALL') },
    { id: 'OPEN', label: 'Abertos', count: count('OPEN') },
    { id: 'PAID', label: 'Pagos', count: count('PAID') },
    { id: 'CANCELLED', label: 'Cancelados', count: count('CANCELLED') },
  ]

  const rows = data?.filter((o) => filter === 'ALL' || o.status === filter) ?? []
  const total = rows.reduce((s, o) => s + o.total, 0)
  const [one, many] = NOUN[filter]
  const description = data
    ? rows.length === 0
      ? 'Nenhum pedido nesta visão'
      : `${rows.length} ${plural(rows.length, one, many)}, ${formatBRL(total)} no total`
    : error
      ? 'Pedidos indisponíveis'
      : undefined

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={description ?? <Skeleton className="mt-1.5 h-4 w-48" />}
        actions={
          <>
            <label htmlFor="orders-date" className="sr-only">
              Data
            </label>
            <input
              id="orders-date"
              type="date"
              className="field-sm"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Novo pedido
            </button>
          </>
        }
      />
      <Tabs tabs={tabs} value={filter} onChange={setFilter} label="Status dos pedidos" panelId="orders-panel" />

      <div id="orders-panel" role="tabpanel" aria-labelledby={`orders-panel-tab-${filter}`}>
        <div
          aria-hidden="true"
          className={`hidden h-9 items-center gap-x-3 px-2 text-[13px] text-muted sm:grid ${COLS}`}
        >
          <span />
          <span>Cliente e itens</span>
          <span>Data e hora</span>
          <span>Reserva</span>
          <span>Status</span>
          <span className="text-right sm:order-6">Total</span>
        </div>
        {loading && !data ? (
          <ul aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex h-14 items-center border-b border-line-soft px-2">
                <Skeleton className="h-4 w-56" />
              </li>
            ))}
          </ul>
        ) : error || !data ? (
          <ErrorState what="os pedidos" message={error?.message} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhum pedido encontrado"
            description={
              filter === 'ALL'
                ? 'Nenhum pedido neste dia.'
                : 'Escolha outra aba para ver os demais pedidos.'
            }
          />
        ) : (
          <ul>
            {rows.map((o) => (
              <Row key={o.id} o={o} onChanged={refetch} />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <NewOrderModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refetch()
          }}
        />
      )}
    </>
  )
}
