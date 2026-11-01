import type { Booking, Court, DashboardSummary } from '@marcai/shared'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { kindsOf, MarkLegend } from '../components/BookingMark'
import { DayTimeline } from '../components/DayTimeline'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { KpiStrip } from '../components/KpiStrip'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'
import {
  formatBRL,
  formatDateTime,
  formatHours,
  formatPercent,
  formatTime,
  localMinutes,
  plural,
  today,
} from '../lib/format'
import { getBookings, getCourts, getDashboardSummary, getOrders } from '../services/api'
import { NewBookingModal } from './NewBookingModal'

const OPEN = 7 * 60
const CLOSE = 23 * 60
const HOURS_PER_COURT = (CLOSE - OPEN) / 60

/** O achado do dia, calculado dos dados. */
function finding(s: DashboardSummary): string {
  const n = s.bookingsCount
  if (n === 0) return 'Nenhuma reserva hoje'
  const base = `${n} ${plural(n, 'reserva', 'reservas')} hoje`
  const next = s.upcomingBookings[0]
  if (!next) return `${base}, nenhuma a caminho`
  return `${base}, próxima às ${formatTime(next.startsAt)} na ${next.court?.name ?? 'quadra'}`
}

function bookedHours(bookings: Booking[], courtId: string): number {
  return bookings
    .filter((b) => b.courtId === courtId)
    .reduce((sum, b) => {
      const s = Math.max(localMinutes(b.startsAt), OPEN)
      const e = Math.min(localMinutes(b.endsAt), CLOSE)
      return sum + Math.max(e - s, 0) / 60
    }, 0)
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold whitespace-nowrap">{title}</h2>
        {aside}
      </div>
      <div className="panel">{children}</div>
    </section>
  )
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <div className="border-t border-line-soft p-3">
      <Link to={to} className="btn-ghost w-full">
        {label}
      </Link>
    </div>
  )
}

export function Dashboard() {
  const day = today()
  const [creating, setCreating] = useState(false)
  const summary = useFetch(() => getDashboardSummary(), [])
  const courts = useFetch(getCourts, [])
  const bookings = useFetch(() => getBookings(day), [day])
  const openOrders = useFetch(() => getOrders('OPEN'), [])

  const activeCourts: Court[] = courts.data?.filter((c) => c.active) ?? []
  const live = bookings.data?.filter((b) => b.status !== 'CANCELLED') ?? []
  const s = summary.data

  function refetchAll() {
    summary.refetch()
    bookings.refetch()
    openOrders.refetch()
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          s ? (
            finding(s)
          ) : summary.error ? (
            'Resumo do dia indisponível'
          ) : (
            <Skeleton className="mt-1.5 h-4 w-72" />
          )
        }
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreating(true)}
            disabled={activeCourts.length === 0}
          >
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Nova reserva
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            {summary.error ? (
              <div className="panel">
                <ErrorState
                  what="os indicadores do dia"
                  message={summary.error.message}
                  onRetry={summary.refetch}
                />
              </div>
            ) : (
              <KpiStrip
                label="Indicadores do dia"
                items={[
                  {
                    label: 'Reservas hoje',
                    value: s && String(s.bookingsCount),
                    caption: 'sem as canceladas',
                  },
                  {
                    label: 'Ocupação',
                    value: s && formatPercent(s.occupancyRate),
                    caption: 'das 16 h de cada quadra ativa',
                    extra: s && (
                      <div
                        className="mt-1 h-1 overflow-hidden rounded-sm bg-primary-soft"
                        role="img"
                        aria-label={`Ocupação de ${formatPercent(s.occupancyRate)}`}
                      >
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(s.occupancyRate, 1) * 100}%` }}
                        />
                      </div>
                    ),
                  },
                  {
                    label: 'Faturamento do dia',
                    value: s && formatBRL(s.revenue),
                    caption: 'reservas confirmadas e pedidos pagos',
                  },
                  {
                    label: 'Pedidos abertos',
                    value: s && String(s.openOrdersCount),
                    caption: 'de qualquer dia',
                  },
                ]}
              />
            )}
          </div>

          <Section title="Quadras hoje" aside={<MarkLegend kinds={kindsOf(live)} />}>
            {courts.error || bookings.error ? (
              <ErrorState
                what="a agenda de hoje"
                message={(courts.error ?? bookings.error)?.message}
                onRetry={() => {
                  courts.refetch()
                  bookings.refetch()
                }}
              />
            ) : !courts.data || !bookings.data ? (
              <div className="px-4 pb-3" aria-busy="true">
                <div className="h-7" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex h-[60px] items-center border-t border-line-soft">
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <DayTimeline courts={activeCourts} bookings={live} showNow />
                {live.length === 0 && (
                  <p className="border-t border-line-soft px-4 py-3 text-sm text-muted">
                    Nenhuma reserva para hoje.
                  </p>
                )}
              </>
            )}
          </Section>

          <Section title="Horas reservadas por quadra" aside={<span className="text-xs text-muted">de 16 h por dia</span>}>
            {!courts.data || !bookings.data ? (
              <ul aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex h-11 items-center border-t border-line-soft px-4 first:border-t-0">
                    <Skeleton className="h-4 w-40" />
                  </li>
                ))}
              </ul>
            ) : activeCourts.length === 0 ? (
              <EmptyState title="Nenhuma quadra ativa" />
            ) : (
              <ul>
                {activeCourts.map((c) => {
                  const h = bookedHours(live, c.id)
                  return (
                    <li
                      key={c.id}
                      className="grid h-11 grid-cols-[148px_minmax(0,1fr)_64px] items-center gap-4 border-t border-line-soft px-4 first:border-t-0"
                    >
                      <span className="truncate text-sm">{c.name}</span>
                      <div
                        className="h-1.5 overflow-hidden rounded-sm bg-primary-soft"
                        role="img"
                        aria-label={`${formatHours(h)} de ${HOURS_PER_COURT} h`}
                      >
                        <div className="h-full bg-primary" style={{ width: `${(h / HOURS_PER_COURT) * 100}%` }} />
                      </div>
                      <span className="text-right text-sm">{formatHours(h)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Próximas reservas"
            aside={
              s && <span className="text-xs text-muted">{s.upcomingBookings.length} a caminho</span>
            }
          >
            {summary.error ? (
              <ErrorState what="as próximas reservas" onRetry={refetchAll} />
            ) : !s ? (
              <ul aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex h-[52px] items-center border-t border-line-soft px-4 first:border-t-0">
                    <Skeleton className="h-4 w-48" />
                  </li>
                ))}
              </ul>
            ) : s.upcomingBookings.length === 0 ? (
              <EmptyState title="Nenhuma reserva a caminho" />
            ) : (
              <>
                <ul>
                  {s.upcomingBookings.slice(0, 5).map((b) => (
                    <li
                      key={b.id}
                      className="grid min-h-[52px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-4 py-2 first:border-t-0"
                    >
                      <div className="text-sm leading-5">
                        <p className="font-medium">{formatTime(b.startsAt)}</p>
                        <p className="text-[13px] text-muted">{formatTime(b.endsAt)}</p>
                      </div>
                      <div className="min-w-0 leading-5">
                        <p className="truncate text-sm font-medium">{b.customerName}</p>
                        <p className="truncate text-[13px] text-muted">{b.court?.name ?? 'Quadra'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm">{formatBRL(b.price)}</span>
                        <StatusBadge kind="booking" status={b.status} />
                      </div>
                    </li>
                  ))}
                </ul>
                <SeeAll to="/agenda" label="Ver todos" />
              </>
            )}
          </Section>

          <Section
            title="Pedidos abertos"
            aside={
              openOrders.data && (
                <span className="text-xs text-muted">
                  {openOrders.data.length} {plural(openOrders.data.length, 'pedido', 'pedidos')}
                </span>
              )
            }
          >
            {openOrders.error ? (
              <ErrorState
                what="os pedidos"
                message={openOrders.error.message}
                onRetry={openOrders.refetch}
              />
            ) : !openOrders.data ? (
              <ul aria-busy="true">
                {[0, 1].map((i) => (
                  <li key={i} className="flex h-[52px] items-center border-t border-line-soft px-4 first:border-t-0">
                    <Skeleton className="h-4 w-40" />
                  </li>
                ))}
              </ul>
            ) : openOrders.data.length === 0 ? (
              <EmptyState title="Nenhum pedido aberto" />
            ) : (
              <>
                <ul>
                  {openOrders.data.slice(0, 4).map((o) => {
                    const qty = o.items.reduce((n, i) => n + i.quantity, 0)
                    return (
                      <li
                        key={o.id}
                        className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-4 py-2 first:border-t-0"
                      >
                        <div className="min-w-0 leading-5">
                          <p className="truncate text-sm font-medium">
                            {o.customerName ?? 'Sem nome'}
                          </p>
                          <p className="truncate text-[13px] text-muted">
                            {qty} {plural(qty, 'item', 'itens')} · {formatDateTime(o.createdAt)}
                          </p>
                        </div>
                        <span className="text-sm">{formatBRL(o.total)}</span>
                      </li>
                    )
                  })}
                </ul>
                <SeeAll to="/pedidos" label="Ver todos" />
              </>
            )}
          </Section>
        </div>
      </div>

      {creating && (
        <NewBookingModal
          courts={courts.data ?? []}
          date={day}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refetchAll()
          }}
        />
      )}
    </>
  )
}
