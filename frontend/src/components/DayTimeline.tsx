import { BOOKING_STATUS_LABELS, type Booking, type Court, SPORT_LABELS } from '@marcai/shared'
import { useNow } from '../hooks/useNow'
import { firstName, formatTime, localMinutes, minutesToHHMM } from '../lib/format'
import { MARK_CLASS } from './BookingMark'

const OPEN = 7 * 60
const CLOSE = 23 * 60
const SPAN = CLOSE - OPEN
const LABEL_W = 148
const pct = (min: number): string => `${((min - OPEN) / SPAN) * 100}%`

const TICKS: number[] = []
for (let m = OPEN; m <= CLOSE; m += 120) TICKS.push(m)

interface Props {
  courts: Court[]
  bookings: Booking[]
  /** Mostra a linha de agora (só quando o dia exibido é hoje). */
  showNow: boolean
}

/** Linhas = quadras, horas de 07:00 a 23:00 na horizontal. Moldura fixa; estados vazios não mudam o tamanho. */
export function DayTimeline({ courts, bookings, showNow }: Props) {
  const now = useNow()
  const nowMin = localMinutes(now.toISOString())
  const nowVisible = showNow && nowMin >= OPEN && nowMin <= CLOSE

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[640px] px-4 pb-3">
        {/* Linhas de hora e linha de agora, atrás e à frente das marcas */}
        <div
          className="pointer-events-none absolute top-7 bottom-3 right-4"
          style={{ left: LABEL_W + 16 }}
          aria-hidden="true"
        >
          {Array.from({ length: 17 }, (_, i) => (
            <span
              key={i}
              className={`absolute inset-y-0 w-px ${i % 2 === 0 ? 'bg-line' : 'bg-line-soft'}`}
              style={{ left: `${(i / 16) * 100}%` }}
            />
          ))}
        </div>

        <div className="flex h-7 items-end" style={{ paddingLeft: LABEL_W }}>
          <div className="relative h-5 flex-1" aria-hidden="true">
            {TICKS.map((m, i) => (
              <span
                key={m}
                className="absolute top-0 text-xs text-muted"
                style={{
                  left: pct(m),
                  transform: i === 0 ? 'none' : i === TICKS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {minutesToHHMM(m)}
              </span>
            ))}
          </div>
        </div>

        {courts.map((c) => {
          const mine = bookings.filter((b) => b.courtId === c.id)
          return (
            <div key={c.id} className="relative flex h-[60px] items-center border-t border-line-soft">
              <div className="flex-none pr-3" style={{ width: LABEL_W }}>
                <p className="truncate text-sm font-medium leading-5">{c.name}</p>
                <p className="truncate text-xs text-muted">{SPORT_LABELS[c.sport]}</p>
              </div>
              <div className="relative h-full flex-1">
                {mine.map((b) => {
                  const s = Math.max(localMinutes(b.startsAt), OPEN)
                  const e = Math.min(localMinutes(b.endsAt), CLOSE)
                  if (e <= s) return null
                  const label = `${b.customerName}, ${formatTime(b.startsAt)} – ${formatTime(b.endsAt)}, ${BOOKING_STATUS_LABELS[b.status]}`
                  return (
                    <div
                      key={b.id}
                      title={label}
                      aria-label={label}
                      className={`absolute top-4 flex h-7 items-center overflow-hidden rounded-sm px-1.5 text-[13px] leading-none whitespace-nowrap ${MARK_CLASS[b.status]}`}
                      style={{ left: pct(s), width: `${((e - s) / SPAN) * 100}%` }}
                    >
                      <span className="truncate">{firstName(b.customerName)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {nowVisible && (
          <div
            className="pointer-events-none absolute top-7 bottom-3 right-4 z-[2]"
            style={{ left: LABEL_W + 16 }}
            aria-hidden="true"
          >
            <span
              className="absolute inset-y-0 w-px bg-primary"
              style={{ left: pct(nowMin) }}
              title={`Agora, ${minutesToHHMM(nowMin)}`}
            >
              <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-primary" />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
