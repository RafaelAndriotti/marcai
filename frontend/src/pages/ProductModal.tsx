import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type Product,
  type ProductCategory,
  type UpdateProductInput,
} from '@marcai/shared'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { parsePrice, priceError, priceToInput } from '../lib/price'
import { ApiError, createProduct, updateProduct } from '../services/api'

interface FieldErrors {
  name?: string
  price?: string
}

interface Props {
  /** Presente = edição. */
  product?: Product
  onClose: () => void
  onSaved: () => void
}

/** Traduz erro da API em mensagem de campo ou geral. */
function mapError(e: unknown): { fields: FieldErrors; general?: string } {
  if (!(e instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar o item. Tente novamente.' }
  switch (e.code) {
    case 'PRODUCT_NAME_TAKEN':
      return { fields: { name: 'Já existe um item com esse nome.' } }
    case 'NOT_FOUND':
      return { fields: {}, general: 'Item não encontrado. Feche e atualize a lista.' }
    case 'VALIDATION_ERROR': {
      const issues = Array.isArray(e.details) ? (e.details as { path?: unknown; message?: unknown }[]) : []
      const paths = issues.map((i) => String(i.path ?? ''))
      const fields: FieldErrors = {}
      if (paths.includes('name'))
        fields.name = issues.some((i) => /control|invisible/.test(String(i.message ?? '')))
          ? 'O nome não pode ter caracteres de controle ou invisíveis.'
          : 'Informe um nome de até 80 caracteres.'
      if (paths.includes('price'))
        fields.price = 'O preço deve ser maior que zero, até R$ 100.000,00, com até 2 casas decimais.'
      return Object.keys(fields).length
        ? { fields }
        : { fields: {}, general: 'Dados inválidos. Revise o formulário.' }
    }
    case 'NETWORK_ERROR':
      return { fields: {}, general: e.message }
    default:
      return { fields: {}, general: 'Erro no servidor. Tente novamente em instantes.' }
  }
}

export function ProductModal({ product, onClose, onSaved }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (s: string) => `${uid}-${s}`
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? 'BEBIDA')
  const [price, setPrice] = useState(product ? priceToInput(product.price) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Foco no primeiro campo com erro, depois que o erro já está no DOM.
  useEffect(() => {
    if (errors.name) document.getElementById(id('name'))?.focus()
    else if (errors.price) document.getElementById(id('price'))?.focus()
  }, [errors])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const next: FieldErrors = {}
    if (!trimmed) next.name = 'Informe o nome do item.'
    else if (trimmed.length > 80) next.name = 'Use no máximo 80 caracteres.'
    const pe = priceError(price)
    if (pe) next.price = pe
    setErrors(next)
    setGeneral(undefined)
    if (next.name || next.price) return
    const value = parsePrice(price)
    if (value === undefined) return

    setSaving(true)
    try {
      if (product) {
        const patch: UpdateProductInput = {}
        if (trimmed !== product.name) patch.name = trimmed
        if (category !== product.category) patch.category = category
        if (Math.round(value * 100) !== Math.round(product.price * 100)) patch.price = value
        if (Object.keys(patch).length === 0) {
          onClose()
          return
        }
        await updateProduct(product.id, patch)
      } else {
        await createProduct({ name: trimmed, category, price: value })
      }
      onSaved()
    } catch (err) {
      const m = mapError(err)
      setErrors(m.fields)
      setGeneral(m.general)
      setSaving(false)
    }
  }

  return (
    <Modal title={product ? 'Editar item' : 'Novo item'} onClose={onClose}>
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
          <label htmlFor={id('name')} className="mb-1.5 block text-sm font-medium">
            Nome
          </label>
          <input
            id={id('name')}
            className="field"
            autoComplete="off"
            maxLength={80}
            required
            value={name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={`${id('name-hint')}${errors.name ? ` ${id('name-err')}` : ''}`}
            onChange={(e) => setName(e.target.value)}
          />
          <p id={id('name-hint')} className="mt-1 text-xs text-muted">
            Até 80 caracteres. Cada nome vale uma vez só.
          </p>
          {errors.name && (
            <p id={id('name-err')} role="alert" className="mt-1 text-xs text-danger-fg">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('cat')} className="mb-1.5 block text-sm font-medium">
              Categoria
            </label>
            <select
              id={id('cat')}
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={id('price')} className="mb-1.5 block text-sm font-medium">
              Preço (R$)
            </label>
            <input
              id={id('price')}
              className="field"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              value={price}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={`${id('price-hint')}${errors.price ? ` ${id('price-err')}` : ''}`}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p id={id('price-hint')} className="mt-1 text-xs text-muted">
              Maior que zero e até R$ 100.000,00, com até 2 casas.
            </p>
            {errors.price && (
              <p id={id('price-err')} role="alert" className="mt-1 text-xs text-danger-fg">
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
            {saving ? 'Salvando…' : product ? 'Salvar alterações' : 'Criar item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
