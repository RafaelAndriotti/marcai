import { BOOKING_STATUS_LABELS, type BookingStatus } from '@marcai/shared'

/**
 * Uma marca por tipo de reserva (regra de calendário):
 * confirmada = preenchimento pálido + borda esquerda de 3px no matiz,
 * pendente = contorno tracejado, concluída = degrau cinza.
 */
export const MARK_CLASS: Record<BookingStatus, string> = {
  CONFIRMED: 'border-l-[3px] border-l-primary bg-primary-wash text-fg',
  PENDING: 'border border-dashed border-muted bg-transparent text-fg',
  DONE: 'bg-neutral-soft text-neutral-fg',
  CANCELLED: 'bg-danger-soft text-danger-fg',
}

/** Legenda: o próprio sinal em escala menor, só dos tipos que estão na tela. */
export function MarkLegend({ kinds }: { kinds: BookingStatus[] }) {
  if (kinds.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
      {kinds.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`block h-3 w-5 rounded-sm ${MARK_CLASS[s]}`} aria-hidden="true" />
          {BOOKING_STATUS_LABELS[s]}
        </li>
      ))}
    </ul>
  )
}

/** Tipos presentes numa lista, na ordem fixa da legenda. */
export function kindsOf(bookings: { status: BookingStatus }[]): BookingStatus[] {
  const order: BookingStatus[] = ['CONFIRMED', 'PENDING', 'DONE']
  return order.filter((k) => bookings.some((b) => b.status === k))
}
