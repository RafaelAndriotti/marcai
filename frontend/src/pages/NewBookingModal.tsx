import { BOOKING_DURATION, type Court } from '@marcai/shared'
import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { minutesToHHMM, toIso } from '../lib/format'
import { ApiError, createBooking } from '../services/api'

const OPEN = 7 * 60
const CLOSE = 23 * 60

const START_OPTIONS: number[] = []
for (let m = OPEN; m < CLOSE; m += 30) START_OPTIONS.push(m)

const DURATION_OPTIONS: number[] = []
for (let m = BOOKING_DURATION.minMinutes; m <= BOOKING_DURATION.maxMinutes; m += BOOKING_DURATION.stepMinutes) {
  DURATION_OPTIONS.push(m)
}

const durationLabel = (m: number): string =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

const MESSAGE_MAP: [string, string][] = [
  ['business hours', 'O horário deve estar dentro do funcionamento (07:00 às 23:00).'],
  ['at least 30', 'A duração mínima é de 30 minutos.'],
  ['at most 4', 'A duração máxima é de 4 horas.'],
  ['multiple of 30', 'A duração deve ser múltipla de 30 minutos.'],
  ['same local day', 'A reserva deve começar e terminar no mesmo dia.'],
  ['after startsAt', 'O término deve ser depois do início.'],
  ['must not contain', 'O nome contém caracteres inválidos.'],
  ['court is inactive', 'Esta quadra foi removida. Atualize a página e escolha outra quadra.'],
]

/** Converte um erro da API em mensagens amigáveis em pt-BR. */
function friendlyBookingError(e: unknown): string[] {
  if (!(e instanceof ApiError)) return ['Não foi possível criar a reserva. Tente novamente.']
  switch (e.code) {
    case 'BOOKING_CONFLICT':
      return ['Essa quadra já está reservada nesse horário. Escolha outro horário ou outra quadra.']
    case 'NOT_FOUND':
      return ['Quadra não encontrada. Atualize a página e tente novamente.']
    case 'VALIDATION_ERROR': {
      const issues = Array.isArray(e.details) ? (e.details as { message?: unknown }[]) : []
      const msgs = issues.flatMap((i) => {
        const raw = typeof i.message === 'string' ? i.message : ''
        const hit = MESSAGE_MAP.find(([k]) => raw.includes(k))
        return hit ? [hit[1]] : raw ? [raw] : []
      })
      return msgs.length ? [...new Set(msgs)] : ['Dados inválidos. Revise o formulário.']
    }
    case 'NETWORK_ERROR':
      return [e.message]
    default:
      return ['Erro no servidor. Tente novamente em instantes.']
  }
}

interface Props {
  courts: Court[]
  date: string
  defaultCourtId?: string
  defaultStart?: number
  onClose: () => void
  onCreated: () => void
}

export function NewBookingModal({
  courts,
  date: initialDate,
  defaultCourtId,
  defaultStart,
  onClose,
  onCreated,
}: Props) {
  const uid = useId()
  const active = courts.filter((c) => c.active)
  const [courtId, setCourtId] = useState(defaultCourtId ?? active[0]?.id ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(initialDate)
  const [start, setStart] = useState(defaultStart ?? 18 * 60)
  const [duration, setDuration] = useState(60)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErrors(['Informe a data da reserva.'])
      return
    }
    if (start + duration > CLOSE) {
      setErrors(['O horário deve estar dentro do funcionamento (07:00 às 23:00).'])
      return
    }
    setSaving(true)
    setErrors([])
    try {
      await createBooking({
        courtId,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        startsAt: toIso(date, start),
        endsAt: toIso(date, start + duration),
      })
      onCreated()
    } catch (err) {
      setErrors(friendlyBookingError(err))
      setSaving(false)
    }
  }

  const id = (s: string) => `${uid}-${s}`

  return (
    <Modal title="Nova reserva" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            <ul className="list-disc pl-4">
              {errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label htmlFor={id('court')} className="mb-1.5 block text-sm font-medium">
            Quadra
          </label>
          <select
            id={id('court')}
            className="field"
            required
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
          >
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('name')} className="mb-1.5 block text-sm font-medium">
              Cliente
            </label>
            <input
              id={id('name')}
              className="field"
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id('phone')} className="mb-1.5 block text-sm font-medium">
              Telefone
            </label>
            <input
              id={id('phone')}
              className="field"
              type="tel"
              required
              autoComplete="off"
              placeholder="11999990000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={id('date')} className="mb-1.5 block text-sm font-medium">
              Data
            </label>
            <input
              id={id('date')}
              className="field"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id('start')} className="mb-1.5 block text-sm font-medium">
              Início
            </label>
            <select
              id={id('start')}
              className="field"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            >
              {START_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {minutesToHHMM(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={id('dur')} className="mb-1.5 block text-sm font-medium">
              Duração
            </label>
            <select
              id={id('dur')}
              className="field"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {durationLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-muted">
          Término: {minutesToHHMM(Math.min(start + duration, 24 * 60))}. Funcionamento das 07:00 às 23:00.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost btn-lg" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary btn-lg" disabled={saving || !courtId}>
            {saving ? 'Salvando…' : 'Criar reserva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
