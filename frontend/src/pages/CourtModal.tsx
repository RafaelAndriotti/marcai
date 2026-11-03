import { SPORT_LABELS, type Sport } from '@marcai/shared'
import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { parsePrice, priceError } from '../lib/price'
import { ApiError, createCourt } from '../services/api'

interface Props {
  onClose: () => void
  onCreated: () => void
}

interface FieldErrors {
  name?: string
  price?: string
}

function mapError(e: unknown): { fields: FieldErrors; general?: string } {
  if (!(e instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar a quadra. Tente novamente.' }
  switch (e.code) {
    case 'VALIDATION_ERROR': {
      const issues = Array.isArray(e.details) ? (e.details as { path?: unknown }[]) : []
      const paths = issues.map((i) => String(i.path ?? ''))
      const fields: FieldErrors = {}
      if (paths.includes('name')) fields.name = 'Informe um nome de até 80 caracteres, sem caracteres invisíveis.'
      if (paths.includes('pricePerHour')) fields.price = 'Informe um preço válido, com até 2 casas decimais.'
      return Object.keys(fields).length ? { fields } : { fields: {}, general: 'Dados inválidos. Revise o formulário.' }
    }
    case 'NETWORK_ERROR':
      return { fields: {}, general: e.message }
    default:
      return { fields: {}, general: 'Erro no servidor. Tente novamente em instantes.' }
  }
}

export function CourtModal({ onClose, onCreated }: Props) {
  const uid = useId().replace(/:/g, '')
  const [name, setName] = useState('')
  const [sport, setSport] = useState<Sport>('VOLEI')
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const next: FieldErrors = {}
    if (!trimmed) next.name = 'Informe o nome da quadra.'
    else if (trimmed.length > 80) next.name = 'Use no máximo 80 caracteres.'
    const pe = priceError(price, 'o preço por hora')
    if (pe) next.price = pe
    setErrors(next)
    setGeneral(undefined)
    const value = parsePrice(price)
    if (next.name || next.price || value === undefined) return
    setSaving(true)
    try {
      await createCourt({ name: trimmed, sport, pricePerHour: value })
      onCreated()
    } catch (err) {
      const m = mapError(err)
      setErrors(m.fields)
      setGeneral(m.general)
      setSaving(false)
    }
  }

  return (
    <Modal title="Nova quadra" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {general && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            {general}
          </div>
        )}
        <div>
          <label htmlFor={`${uid}-name`} className="mb-1.5 block text-sm font-medium">
            Nome
          </label>
          <input
            id={`${uid}-name`}
            className="field"
            autoComplete="off"
            maxLength={80}
            autoFocus
            required
            value={name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${uid}-name-err` : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && (
            <p id={`${uid}-name-err`} role="alert" className="mt-1 text-xs text-danger-fg">
              {errors.name}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-sport`} className="mb-1.5 block text-sm font-medium">
              Esporte
            </label>
            <select
              id={`${uid}-sport`}
              className="field"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
            >
              {Object.entries(SPORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-price`} className="mb-1.5 block text-sm font-medium">
              Preço por hora (R$)
            </label>
            <input
              id={`${uid}-price`}
              className="field"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              value={price}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? `${uid}-price-err` : undefined}
              onChange={(e) => setPrice(e.target.value)}
            />
            {errors.price && (
              <p id={`${uid}-price-err`} role="alert" className="mt-1 text-xs text-danger-fg">
                {errors.price}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost btn-lg" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary btn-lg" disabled={saving}>
            {saving ? 'Salvando…' : 'Criar quadra'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
