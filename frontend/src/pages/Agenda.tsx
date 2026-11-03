import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  type Booking,
  type BookingStatus,
} from '@marcai/shared'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { kindsOf, MARK_CLASS, MarkLegend } from '../components/BookingMark'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'
import { useNow } from '../hooks/useNow'
import {
  addDays,
  formatBRL,
  formatLongDate,
  formatTime,
  localMinutes,
  minutesToHHMM,
  plural,
  today,
} from '../lib/format'
import { ApiError, getBookings, getCourts, updateBookingStatus } from '../services/api'
import { NewBookingModal } from './NewBookingModal'

const OPEN = 7 * 60
const CLOSE = 23 * 60
const SLOT = 60
const SLOTS = (CLOSE - OPEN) / SLOT // 16
const ROW = 72 // px por linha de 1 h
const HEAD = 44 // px do cabeçalho de quadras
const TIME_COL = 64 // px da coluna de horas

export function Agenda() {
  const [date, setDate] = useState(today)
  const [creating, setCreating] = useState<{ courtId?: string; start?: number } | null>(null)
  const [selected, setSelected] = useState<Booking | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const now = useNow()

  const courts = useFetch(getCourts, [])
  const bookings = useFetch(() => getBookings(date), [date])

  const activeCourts = courts.data?.filter((c) => c.active) ?? []
  const visible = bookings.data?.filter((b) => b.status !== 'CANCELLED') ?? []
  const cancelled = (bookings.data?.length ?? 0) - visible.length

  const failed = courts.error ?? bookings.error
  const loading = (courts.loading && !courts.data) || (bookings.loading && !bookings.data)

  const isToday = date === today()
  const nowMin = localMinutes(now.toISOString())
  const nowTop = HEAD + ((nowMin - OPEN) / SLOT) * ROW
  const showNow = isToday && nowMin >= OPEN && nowMin <= CLOSE

  // Leva a grade ao horário que interessa: agora (hoje) ou a primeira reserva do dia.
  const ready = !loading && !failed
  useEffect(() => {
    const el = scroller.current
    if (!el || !ready) return
    const first = visible.reduce<number>((m, b) => Math.min(m, localMinutes(b.startsAt)), CLOSE)
    const target = isToday ? nowMin : first
    el.scrollTop = Math.max(0, ((target - OPEN - 60) / SLOT) * ROW)
    // só ao trocar de dia ou quando a grade fica pronta
  }, [date, ready])

  function refetchAll() {
    courts.refetch()
    bookings.refetch()
  }

  const description = failed
    ? formatLongDate(date)
    : `${formatLongDate(date)}, ${visible.length} ${plural(visible.length, 'reserva', 'reservas')}`

  return (
    <>
      <PageHeader
        title="Agenda"
        description={description}
        actions={
          <>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost w-8 px-0"
                onClick={() => setDate(addDays(date, -1))}
                aria-label="Dia anterior"
              >
                <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <label htmlFor="agenda-date" className="sr-only">
                Data
              </label>
              <input
                id="agenda-date"
                type="date"
                className="field-sm"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost w-8 px-0"
                onClick={() => setDate(addDays(date, 1))}
                aria-label="Próximo dia"
              >
                <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDate(today())}
                disabled={isToday}
              >
                Hoje
              </button>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreating({})}
              disabled={activeCourts.length === 0}
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Nova reserva
            </button>
          </>
        }
      />

      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1">
        <MarkLegend kinds={kindsOf(visible)} />
        {cancelled > 0 && (
          <span className="text-xs text-muted">
            {cancelled} {plural(cancelled, 'cancelada oculta', 'canceladas ocultas')}
          </span>
        )}
      </div>

      <div
        ref={scroller}
        className={`panel max-h-[calc(100dvh-14rem)] min-h-80 overflow-auto ${
          bookings.loading && !loading ? 'opacity-70' : ''
        }`}
        aria-busy={bookings.loading}
      >
        {loading ? (
          <div className="grid gap-3 p-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : failed ? (
          <ErrorState what="a agenda" message={failed.message} onRetry={refetchAll} />
        ) : activeCourts.length === 0 ? (
          <ErrorState what="as quadras" message="Nenhuma quadra ativa cadastrada." />
        ) : (
          <div
            role="grid"
            aria-label={`Agenda de ${formatLongDate(date)}`}
            className="relative grid min-w-max"
            style={{
              gridTemplateColumns: `${TIME_COL}px repeat(${activeCourts.length}, minmax(11rem, 1fr))`,
              gridTemplateRows: `${HEAD}px repeat(${SLOTS}, ${ROW}px)`,
            }}
          >
            <div className="sticky top-0 left-0 z-20 border-b border-line bg-surface" />
            {activeCourts.map((c, ci) => (
              <div
                key={c.id}
                role="columnheader"
                className="sticky top-0 z-10 border-b border-l border-line bg-surface px-3 py-1.5"
                style={{ gridColumn: ci + 2, gridRow: 1 }}
              >
                <p className="truncate text-sm font-medium leading-5">{c.name}</p>
                <p className="text-xs leading-4 text-muted">{formatBRL(c.pricePerHour)} /h</p>
              </div>
            ))}

            {Array.from({ length: SLOTS }, (_, i) => {
              const min = OPEN + i * SLOT
              return (
                <div
                  key={min}
                  className="sticky left-0 z-[6] bg-surface pt-1 pr-2 text-right text-xs leading-4 text-muted"
                  style={{ gridColumn: 1, gridRow: i + 2 }}
                >
                  {minutesToHHMM(min)}
                </div>
              )
            })}

            {activeCourts.flatMap((c, ci) =>
              Array.from({ length: SLOTS }, (_, i) => (
                <button
                  key={`${c.id}-${i}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Reservar ${c.name} às ${minutesToHHMM(OPEN + i * SLOT)}`}
                  onClick={() => setCreating({ courtId: c.id, start: OPEN + i * SLOT })}
                  className="border-l border-t border-line hover:bg-primary-wash"
                  style={{ gridColumn: ci + 2, gridRow: i + 2 }}
                />
              )),
            )}

            {visible.map((b) => {
              const ci = activeCourts.findIndex((c) => c.id === b.courtId)
              if (ci < 0) return null
              const s = Math.max(localMinutes(b.startsAt), OPEN)
              const e = Math.min(localMinutes(b.endsAt), CLOSE)
              if (e <= s) return null
              const startSlot = Math.floor((s - OPEN) / SLOT)
              const endSlot = Math.ceil((e - OPEN) / SLOT)
              const span = Math.max(endSlot - startSlot, 1)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b)}
                  className={`z-[5] m-0.5 flex overflow-hidden rounded-sm px-2 text-left text-[13px] leading-[18px] hover:brightness-95 ${MARK_CLASS[b.status]} ${
                    span === 1 ? 'items-center gap-2 py-0' : 'flex-col py-1'
                  }`}
                  style={{ gridColumn: ci + 2, gridRow: `${startSlot + 2} / span ${span}` }}
                  aria-label={`${b.customerName}, ${formatTime(b.startsAt)} às ${formatTime(b.endsAt)}, ${BOOKING_STATUS_LABELS[b.status]}`}
                >
                  <span className="truncate font-medium">{b.customerName}</span>
                  <span className="whitespace-nowrap text-muted">
                    {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
                  </span>
                </button>
              )
            })}

            {showNow && (
              <div
                className="pointer-events-none absolute right-0 z-[8] h-px bg-primary"
                style={{ top: nowTop, left: TIME_COL }}
                aria-hidden="true"
                title={`Agora, ${minutesToHHMM(nowMin)}`}
              >
                <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-primary" />
              </div>
            )}
          </div>
        )}
      </div>

      {creating && (
        <NewBookingModal
          courts={courts.data ?? []}
          date={date}
          defaultCourtId={creating.courtId}
          defaultStart={creating.start}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null)
            bookings.refetch()
          }}
        />
      )}
      {selected && (
        <BookingDetail
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            bookings.refetch()
          }}
        />
      )}
    </>
  )
}

function BookingDetail({
  booking,
  onClose,
  onChanged,
}: {
  booking: Booking
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<BookingStatus>()
  const [error, setError] = useState<string>()

  async function change(status: BookingStatus) {
    setBusy(status)
    setError(undefined)
    try {
      await updateBookingStatus(booking.id, status)
      onChanged()
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'BOOKING_CONFLICT'
          ? 'Não foi possível alterar: o horário conflita com outra reserva.'
          : e instanceof ApiError
            ? e.message
            : 'Erro inesperado.',
      )
      setBusy(undefined)
    }
  }

  return (
    <Modal title="Reserva" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Cliente</dt>
        <dd className="font-medium">{booking.customerName}</dd>
        <dt className="text-muted">Telefone</dt>
        <dd>{booking.customerPhone}</dd>
        <dt className="text-muted">Quadra</dt>
        <dd>{booking.court?.name ?? booking.courtId}</dd>
        <dt className="text-muted">Horário</dt>
        <dd>
          {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
        </dd>
        <dt className="text-muted">Valor</dt>
        <dd className="font-medium">{formatBRL(booking.price)}</dd>
        <dt className="text-muted">Status</dt>
        <dd>
          <StatusBadge kind="booking" status={booking.status} />
        </dd>
      </dl>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {BOOKING_STATUSES.filter((s) => s !== booking.status).map((s) => (
          <button
            key={s}
            type="button"
            className="btn-ghost"
            disabled={busy !== undefined}
            onClick={() => change(s)}
          >
            {busy === s ? 'Salvando…' : `Marcar como ${BOOKING_STATUS_LABELS[s].toLowerCase()}`}
          </button>
        ))}
      </div>
    </Modal>
  )
}
