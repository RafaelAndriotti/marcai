import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  type Booking,
  type BookingStatus,
} from '@marcai/shared'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Spinner } from '../components/Spinner'
import { BOOKING_TONE_CLASS, StatusBadge } from '../components/StatusBadge'
import { useFetch } from '../hooks/useFetch'
import {
  addDays,
  formatBRL,
  formatLongDate,
  formatTime,
  localMinutes,
  minutesToHHMM,
  today,
} from '../lib/format'
import { ApiError, getBookings, getCourts, updateBookingStatus } from '../services/api'
import { NewBookingModal } from './NewBookingModal'

const OPEN = 7 * 60
const CLOSE = 23 * 60
const SLOT = 30
const SLOTS = (CLOSE - OPEN) / SLOT // 32
const ROW_H = '2.25rem'

export function Agenda() {
  const [date, setDate] = useState(today)
  const [creating, setCreating] = useState<{ courtId?: string; start?: number } | null>(null)
  const [selected, setSelected] = useState<Booking | null>(null)

  const courts = useFetch(getCourts, [])
  const bookings = useFetch(() => getBookings(date), [date])

  const activeCourts = courts.data?.filter((c) => c.active) ?? []
  const visible = bookings.data?.filter((b) => b.status !== 'CANCELLED') ?? []
  const cancelled = (bookings.data?.length ?? 0) - visible.length

  const failed = courts.error ?? bookings.error
  const loading = (courts.loading && !courts.data) || (bookings.loading && !bookings.data)

  function refetchAll() {
    courts.refetch()
    bookings.refetch()
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        description={formatLongDate(date)}
        actions={
          <>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost px-2.5"
                onClick={() => setDate(addDays(date, -1))}
                aria-label="Dia anterior"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <label htmlFor="agenda-date" className="sr-only">
                Data
              </label>
              <input
                id="agenda-date"
                type="date"
                className="field w-auto"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost px-2.5"
                onClick={() => setDate(addDays(date, 1))}
                aria-label="Próximo dia"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="btn-ghost" onClick={() => setDate(today())}>
                Hoje
              </button>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreating({})}
              disabled={activeCourts.length === 0}
            >
              <Plus className="size-4" aria-hidden="true" />
              Nova reserva
            </button>
          </>
        }
      />

      {loading ? (
        <Spinner />
      ) : failed ? (
        <ErrorState message={failed.message} onRetry={refetchAll} />
      ) : activeCourts.length === 0 ? (
        <ErrorState message="Nenhuma quadra ativa cadastrada." />
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
            {BOOKING_STATUSES.filter((s) => s !== 'CANCELLED').map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={`size-3 rounded ${BOOKING_TONE_CLASS[s]}`} aria-hidden="true" />
                {BOOKING_STATUS_LABELS[s]}
              </li>
            ))}
            {cancelled > 0 && <li>{cancelled} cancelada(s) oculta(s)</li>}
          </ul>

          <div
            className={`card overflow-auto ${bookings.loading ? 'opacity-70' : ''}`}
            aria-busy={bookings.loading}
          >
            <div
              role="grid"
              aria-label={`Agenda de ${formatLongDate(date)}`}
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `4rem repeat(${activeCourts.length}, minmax(11rem, 1fr))`,
                gridTemplateRows: `auto repeat(${SLOTS}, ${ROW_H})`,
              }}
            >
              <div className="sticky left-0 top-0 z-20 border-b border-line bg-surface" />
              {activeCourts.map((c, ci) => (
                <div
                  key={c.id}
                  role="columnheader"
                  className="sticky top-0 z-10 border-b border-l border-line bg-surface px-3 py-2 text-sm font-bold"
                  style={{ gridColumn: ci + 2, gridRow: 1 }}
                >
                  {c.name}
                </div>
              ))}

              {Array.from({ length: SLOTS }, (_, i) => {
                const min = OPEN + i * SLOT
                const onHour = min % 60 === 0
                return (
                  <div
                    key={min}
                    className="sticky left-0 z-10 border-line bg-surface pr-2 text-right text-xs text-muted tabular-nums"
                    style={{ gridColumn: 1, gridRow: i + 2 }}
                  >
                    {onHour && <span className="relative -top-2">{minutesToHHMM(min)}</span>}
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
                    className={`border-l border-line hover:bg-primary-soft/40 ${
                      (OPEN + i * SLOT) % 60 === 0 ? 'border-t' : 'border-t border-t-line/40'
                    }`}
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
                const row = startSlot + 2
                const span = Math.max(endSlot - startSlot, 1)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelected(b)}
                    className={`z-[5] m-0.5 flex flex-col overflow-hidden rounded-lg border border-current/20 px-2 py-1 text-left text-xs leading-tight shadow-sm hover:brightness-95 ${BOOKING_TONE_CLASS[b.status]}`}
                    style={{ gridColumn: ci + 2, gridRow: `${row} / span ${span}` }}
                    aria-label={`${b.customerName}, ${formatTime(b.startsAt)} às ${formatTime(b.endsAt)}, ${BOOKING_STATUS_LABELS[b.status]}`}
                  >
                    <span className="truncate font-bold">{b.customerName}</span>
                    <span className="tabular-nums opacity-90">
                      {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

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
        <dd className="tabular-nums">
          {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
        </dd>
        <dt className="text-muted">Valor</dt>
        <dd className="font-semibold tabular-nums">{formatBRL(booking.price)}</dd>
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
