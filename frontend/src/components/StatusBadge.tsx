import {
  BOOKING_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type BookingStatus,
  type OrderStatus,
} from '@marcai/shared'

const TONES = {
  warn: 'bg-warn-soft text-warn-fg',
  ok: 'bg-primary-soft text-primary-soft-fg',
  info: 'bg-info-soft text-info-fg',
  bad: 'bg-danger-soft text-danger-fg',
} as const

type Tone = keyof typeof TONES

/** Cor por status de reserva (reutilizada na agenda). */
export const BOOKING_TONE_CLASS: Record<BookingStatus, string> = {
  PENDING: TONES.warn,
  CONFIRMED: TONES.ok,
  DONE: TONES.info,
  CANCELLED: TONES.bad,
}
const ORDER_TONE: Record<OrderStatus, Tone> = { OPEN: 'warn', PAID: 'ok', CANCELLED: 'bad' }

type Props =
  | { kind: 'booking'; status: BookingStatus }
  | { kind: 'order'; status: OrderStatus }

export function StatusBadge(props: Props) {
  const cls =
    props.kind === 'booking' ? BOOKING_TONE_CLASS[props.status] : TONES[ORDER_TONE[props.status]]
  const label =
    props.kind === 'booking'
      ? BOOKING_STATUS_LABELS[props.status]
      : ORDER_STATUS_LABELS[props.status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}
