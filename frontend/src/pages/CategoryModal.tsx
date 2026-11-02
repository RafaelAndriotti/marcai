import type { Category } from '@marcai/shared'
import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ApiError, createCategory } from '../services/api'

interface Props {
  onClose: () => void
  onCreated: (category: Category) => void
}

function mapError(e: unknown): { name?: string; general?: string } {
  if (!(e instanceof ApiError)) return { general: 'Não foi possível salvar a categoria. Tente novamente.' }
  switch (e.code) {
    case 'CATEGORY_NAME_TAKEN':
      return { name: 'Já existe uma categoria com esse nome.' }
    case 'CATEGORY_LIMIT_REACHED':
      return { general: 'Limite de 50 categorias atingido.' }
    case 'VALIDATION_ERROR': {
      const issues = Array.isArray(e.details) ? (e.details as { message?: unknown }[]) : []
      return {
        name: issues.some((i) => /control|invisible/.test(String(i.message ?? '')))
          ? 'O nome não pode ter caracteres de controle ou invisíveis.'
          : 'Informe um nome de até 40 caracteres.',
      }
    }
    case 'NETWORK_ERROR':
      return { general: e.message }
    default:
      return { general: 'Erro no servidor. Tente novamente em instantes.' }
  }
}

export function CategoryModal({ onClose, onCreated }: Props) {
  const uid = useId().replace(/:/g, '')
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    setGeneral(undefined)
    if (!trimmed) return setError('Informe o nome da categoria.')
    if (trimmed.length > 40) return setError('Use no máximo 40 caracteres.')
    setError(undefined)
    setSaving(true)
    try {
      onCreated(await createCategory({ name: trimmed }))
    } catch (err) {
      const m = mapError(err)
      setError(m.name)
      setGeneral(m.general)
      setSaving(false)
    }
  }

  return (
    <Modal title="Nova categoria" onClose={onClose}>
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
            maxLength={40}
            autoFocus
            required
            value={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${uid}-err` : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {error && (
            <p id={`${uid}-err`} role="alert" className="mt-1 text-xs text-danger-fg">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost btn-lg" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary btn-lg" disabled={saving}>
            {saving ? 'Salvando…' : 'Criar categoria'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
