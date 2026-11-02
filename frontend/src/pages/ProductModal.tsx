import type { Category, Product, UpdateProductInput } from '@marcai/shared'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { formatBRL } from '../lib/format'
import {
  marginError,
  parsePrice,
  parseStock,
  previewPrice,
  priceError,
  priceToInput,
  stockError,
} from '../lib/price'
import { ApiError, createProduct, updateProduct } from '../services/api'

interface FieldErrors {
  name?: string
  cost?: string
  margin?: string
  stock?: string
}

interface Props {
  /** Presente = edição. */
  product?: Product
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

/** Traduz erro da API em mensagem de campo ou geral. */
function mapError(e: unknown): { fields: FieldErrors; general?: string } {
  if (!(e instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar o item. Tente novamente.' }
  switch (e.code) {
    case 'PRODUCT_NAME_TAKEN':
      return { fields: { name: 'Já existe um item com esse nome.' } }
    case 'STOCK_CHANGED':
      return { fields: {}, general: 'O estoque mudou enquanto você editava. Recarregue e tente de novo.' }
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
      if (paths.includes('costPrice'))
        fields.cost = 'O valor de compra deve ser maior que zero, com até 2 casas decimais.'
      if (paths.includes('profitMargin')) fields.margin = 'A margem deve ficar entre 0% e 1.000%.'
      if (paths.includes('stockQuantity')) fields.stock = 'O estoque deve ser um inteiro de 0 a 1.000.000.'
      if (paths.includes('categoryId'))
        return { fields: {}, general: 'Categoria não encontrada. Feche e atualize a lista.' }
      if (paths.includes('price'))
        fields.cost = 'O preço de venda resultante deve ficar entre R$ 0,01 e R$ 100.000,00.'
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

export function ProductModal({ product, categories, onClose, onSaved }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (s: string) => `${uid}-${s}`
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.categoryId ?? categories[0]?.id ?? '')
  const [cost, setCost] = useState(product ? priceToInput(product.costPrice) : '')
  const [margin, setMargin] = useState(product ? String(product.profitMargin).replace('.', ',') : '')
  const [stock, setStock] = useState(product ? String(product.stockQuantity) : '')
  const [sale, setSale] = useState(product ? formatBRL(previewPrice(product.costPrice, product.profitMargin)) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  // Foco no primeiro campo com erro, depois que o erro já está no DOM.
  useEffect(() => {
    if (errors.name) document.getElementById(id('name'))?.focus()
    else if (errors.cost) document.getElementById(id('cost'))?.focus()
    else if (errors.margin) document.getElementById(id('margin'))?.focus()
    else if (errors.stock) document.getElementById(id('stock'))?.focus()
  }, [errors])

  // Preço de venda só é recalculado ao sair de custo/margem (onBlur), não a cada tecla.
  function recalcSale(c: string, m: string) {
    const costN = parsePrice(c)
    const marginN = parsePrice(m)
    setSale(costN !== undefined && marginN !== undefined ? formatBRL(previewPrice(costN, marginN)) : '')
  }

  function onCostBlur() {
    const n = parsePrice(cost)
    const next = n !== undefined ? priceToInput(n) : cost
    if (next !== cost) setCost(next)
    recalcSale(next, margin)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const next: FieldErrors = {}
    if (!trimmed) next.name = 'Informe o nome do item.'
    else if (trimmed.length > 80) next.name = 'Use no máximo 80 caracteres.'
    const ce = priceError(cost, 'o valor de compra')
    if (ce) next.cost = ce
    const me = marginError(margin)
    if (me) next.margin = me
    // só valida se mudou: o estoque salvo pode estar acima do limite após cancelamentos
    const se = !product || stock.trim() !== String(product.stockQuantity) ? stockError(stock) : ''
    if (se) next.stock = se
    setErrors(next)
    setGeneral(undefined)
    if (next.name || next.cost || next.margin || next.stock) return
    const costValue = parsePrice(cost)
    const marginValue = parsePrice(margin)
    const stockChanged = !product || stock.trim() !== String(product.stockQuantity)
    const stockValue = stockChanged ? parseStock(stock) : product.stockQuantity
    if (costValue === undefined || marginValue === undefined || stockValue === undefined) return

    setSaving(true)
    try {
      if (product) {
        const patch: UpdateProductInput = {}
        if (trimmed !== product.name) patch.name = trimmed
        if (category !== product.categoryId) patch.categoryId = category
        if (Math.round(costValue * 100) !== Math.round(product.costPrice * 100)) patch.costPrice = costValue
        if (Math.round(marginValue * 100) !== Math.round(product.profitMargin * 100)) patch.profitMargin = marginValue
        if (stockChanged) {
          patch.stockQuantity = stockValue
          patch.expectedStockQuantity = product.stockQuantity
        }
        if (Object.keys(patch).length === 0) {
          onClose()
          return
        }
        await updateProduct(product.id, patch)
      } else {
        await createProduct({
          name: trimmed,
          categoryId: category,
          costPrice: costValue,
          profitMargin: marginValue,
          stockQuantity: stockValue,
        })
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
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={id('cost')} className="mb-1.5 block text-sm font-medium">
              Valor de compra (R$)
            </label>
            <input
              id={id('cost')}
              className="field"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              value={cost}
              aria-invalid={errors.cost ? true : undefined}
              aria-describedby={`${id('cost-hint')}${errors.cost ? ` ${id('cost-err')}` : ''}`}
              onChange={(e) => setCost(e.target.value)}
              onBlur={onCostBlur}
            />
            <p id={id('cost-hint')} className="mt-1 text-xs text-muted">
              Quanto o item custa para você. Maior que zero.
            </p>
            {errors.cost && (
              <p id={id('cost-err')} role="alert" className="mt-1 text-xs text-danger-fg">
                {errors.cost}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('margin')} className="mb-1.5 block text-sm font-medium">
              Margem de lucro (%)
            </label>
            <input
              id={id('margin')}
              className="field"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              required
              value={margin}
              aria-invalid={errors.margin ? true : undefined}
              aria-describedby={`${id('margin-hint')}${errors.margin ? ` ${id('margin-err')}` : ''}`}
              onChange={(e) => setMargin(e.target.value)}
              onBlur={() => recalcSale(cost, margin)}
            />
            <p id={id('margin-hint')} className="mt-1 text-xs text-muted">
              De 0 a 1.000%, até 2 casas.
            </p>
            {errors.margin && (
              <p id={id('margin-err')} role="alert" className="mt-1 text-xs text-danger-fg">
                {errors.margin}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={id('stock')} className="mb-1.5 block text-sm font-medium">
              Quantidade em estoque
            </label>
            <input
              id={id('stock')}
              className="field"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              required
              value={stock}
              aria-invalid={errors.stock ? true : undefined}
              aria-describedby={`${id('stock-hint')}${errors.stock ? ` ${id('stock-err')}` : ''}`}
              onChange={(e) => setStock(e.target.value)}
            />
            <p id={id('stock-hint')} className="mt-1 text-xs text-muted">
              Número inteiro. Os pedidos baixam o estoque.
            </p>
            {errors.stock && (
              <p id={id('stock-err')} role="alert" className="mt-1 text-xs text-danger-fg">
                {errors.stock}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('sale')} className="mb-1.5 block text-sm font-medium">
              Preço de venda (R$)
            </label>
            <input
              id={id('sale')}
              className="field"
              readOnly
              placeholder="—"
              value={sale}
              aria-describedby={id('sale-hint')}
            />
            <p id={id('sale-hint')} className="mt-1 text-xs text-muted">
              Calculado a partir do valor de compra e da margem.
            </p>
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
