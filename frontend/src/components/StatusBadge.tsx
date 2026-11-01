import {
  BOOKING_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type BookingStatus,
  type OrderStatus,
} from '@marcai/shared'

const TONES = {
  warn: 'bg-warn-soft text-warn-fg',
  ok: 'bg-primary-soft text-primary-ink',
  neutral: 'bg-neutral-soft text-neutral-fg',
  bad: 'bg-danger-soft text-danger-fg',
} as const

type Tone = keyof typeof TONES

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  PENDING: 'warn',
  CONFIRMED: 'ok',
  DONE: 'neutral',
  CANCELLED: 'bad',
}
const ORDER_TONE: Record<OrderStatus, Tone> = { OPEN: 'warn', PAID: 'ok', CANCELLED: 'bad' }

type Props =
  | { kind: 'booking'; status: BookingStatus }
  | { kind: 'order'; status: OrderStatus }

export function StatusBadge(props: Props) {
  const tone = props.kind === 'booking' ? BOOKING_TONE[props.status] : ORDER_TONE[props.status]
  const label =
    props.kind === 'booking'
      ? BOOKING_STATUS_LABELS[props.status]
      : ORDER_STATUS_LABELS[props.status]
  return (
    <span
      className={`inline-flex h-5 flex-none items-center rounded-sm px-1.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {label}
    </span>
  )
}
