import type { Booking, CreateOrderInput, Product } from '@marcai/shared'
import { Minus, Plus } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, formatTime, plural, today } from '../lib/format'
import { ApiError, createOrder, getBookings, getProducts } from '../services/api'

const MAX_QTY = 999

type Mode = 'booking' | 'walkin'

/** Total só para exibição; o servidor é a fonte. Soma em centavos para não acumular erro de ponto flutuante. */
const lineCents = (p: Product, qty: number) => Math.round(p.price * 100) * qty

function friendlyOrderError(e: unknown, products: Product[] = []): string {
  if (!(e instanceof ApiError)) return 'Não foi possível registrar o pedido. Tente novamente.'
  switch (e.code) {
    case 'NOT_FOUND':
      return e.details && typeof e.details === 'object' && 'productId' in e.details
        ? 'Um dos itens não existe mais. Remova a linha marcada e tente de novo.'
        : 'Reserva não encontrada. Escolha outra ou use cliente avulso.'
    case 'INSUFFICIENT_STOCK': {
      const d = e.details as { productId?: string; available?: number } | undefined
      const name = products.find((p) => p.id === d?.productId)?.name
      const of = name ? `de ${name}` : 'de um dos itens'
      return typeof d?.available === 'number'
        ? `Estoque insuficiente: só ${d.available} ${d.available === 1 ? 'unidade disponível' : 'unidades disponíveis'} ${of}. Ajuste a quantidade.`
        : `Estoque insuficiente ${of}. Ajuste a quantidade.`
    }
    case 'VALIDATION_ERROR': {
      const issues = Array.isArray(e.details) ? (e.details as { path?: unknown; message?: unknown }[]) : []
      if (issues.some((i) => i.path === 'total' || /too large/.test(String(i.message ?? ''))))
        return 'O total do pedido passou do limite.'
      if (issues.some((i) => /productId/.test(String(i.path ?? ''))))
        return 'Um dos itens ficou indisponível. Remova a linha marcada e tente de novo.'
      return 'Dados inválidos. Revise o pedido.'
    }
    case 'NETWORK_ERROR':
      return e.message
    default:
      return 'Erro no servidor. Tente novamente em instantes.'
  }
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function NewOrderModal({ onClose, onCreated }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (s: string) => `${uid}-${s}`
  const day = today()
  const products = useFetch(() => getProducts(), [])
  const bookings = useFetch(() => getBookings(day), [day])

  const [modeChoice, setModeChoice] = useState<Mode>()
  const [bookingId, setBookingId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [search, setSearch] = useState('')
  // Ordem de inserção = ordem das linhas. Mesmo item soma na mesma linha.
  const [qty, setQty] = useState<Record<string, number>>({})
  // Produto como estava ao adicionar: a linha continua visível, marcada, se o item sumir ou for desativado.
  const [picked, setPicked] = useState<Record<string, Product>>({})
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const live: Booking[] = useMemo(
    () => bookings.data?.filter((b) => b.status !== 'CANCELLED') ?? [],
    [bookings.data],
  )
  // O padrão só é decidido depois que as reservas chegam; qualquer toque no modo ou no nome o congela.
  const mode: Mode = modeChoice ?? (bookings.data !== undefined && live.length > 0 ? 'booking' : 'walkin')

  const active = useMemo(() => products.data?.filter((p) => p.active) ?? [], [products.data])
  const byId = useMemo(() => new Map(active.map((p) => [p.id, p])), [active])
  const needle = search.trim().toLocaleLowerCase('pt-BR')
  // Grupos vêm dos próprios itens: categoria nova ou falha em /categories não esconde nada.
  const categoryList = [...new Map(active.map((p) => [p.categoryId, { id: p.categoryId, name: p.categoryName }])).values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
  )
  const groups = categoryList.map((c) => ({
    category: c,
    items: active.filter(
      (p) => p.categoryId === c.id && (!needle || p.name.toLocaleLowerCase('pt-BR').includes(needle)),
    ),
  })).filter((g) => g.items.length > 0)

  const lines = Object.entries(qty).flatMap(([pid, q]) => {
    const p = byId.get(pid) ?? picked[pid]
    return p ? [{ product: p, quantity: q, unavailable: !byId.has(pid) }] : []
  })
  const totalCents = lines.reduce((s, l) => (l.unavailable ? s : s + lineCents(l.product, l.quantity)), 0)
  const units = lines.reduce((s, l) => s + l.quantity, 0)

  function add(pid: string) {
    setError(undefined)
    const p = byId.get(pid)
    if (p) setPicked((m) => ({ ...m, [pid]: p }))
    setQty((q) => ({ ...q, [pid]: Math.min((q[pid] ?? 0) + 1, MAX_QTY) }))
  }
  function sub(pid: string) {
    setQty((q) => ({ ...q, [pid]: Math.max((q[pid] ?? 1) - 1, 1) }))
  }
  function remove(pid: string) {
    setQty((q) => {
      const { [pid]: _gone, ...rest } = q
      return rest
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Adicione ao menos um item ao pedido.')
      document.getElementById(id('search'))?.focus()
      return
    }
    if (lines.some((l) => l.unavailable)) {
      setError('Remova os itens indisponíveis para registrar o pedido.')
      return
    }
    if (mode === 'booking' && !bookingId) {
      setError('Escolha a reserva ou troque para cliente avulso.')
      document.getElementById(id('booking'))?.focus()
      return
    }
    const input: CreateOrderInput = {
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    }
    if (mode === 'booking') input.bookingId = bookingId
    else if (customerName.trim()) input.customerName = customerName.trim()

    setSaving(true)
    setError(undefined)
    try {
      await createOrder(input)
      onCreated()
    } catch (err) {
      setError(friendlyOrderError(err, [...Object.values(picked), ...(products.data ?? [])]))
      // Item inativo ou inexistente: recarrega a lista; a linha afetada fica marcada.
      if (err instanceof ApiError && (err.code === 'NOT_FOUND' || err.code === 'VALIDATION_ERROR' || err.code === 'INSUFFICIENT_STOCK')) products.refetch()
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo pedido" onClose={onClose} wide>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            {error}
          </div>
        )}

        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">Cliente</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id('mode')}
                className="size-4 accent-primary"
                checked={mode === 'booking'}
                disabled={live.length === 0}
                onChange={() => setModeChoice('booking')}
              />
              Reserva de hoje
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id('mode')}
                className="size-4 accent-primary"
                checked={mode === 'walkin'}
                onChange={() => setModeChoice('walkin')}
              />
              Cliente avulso
            </label>
          </div>

          {mode === 'booking' ? (
            <div>
              <label htmlFor={id('booking')} className="sr-only">
                Reserva
              </label>
              {bookings.loading && !bookings.data ? (
                <Skeleton className="h-10 w-full" />
              ) : bookings.error ? (
                <ErrorState what="as reservas" message={bookings.error.message} onRetry={bookings.refetch} />
              ) : (
                <select
                  id={id('booking')}
                  className="field"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  aria-describedby={id('booking-hint')}
                >
                  <option value="">Escolha a reserva</option>
                  {live.map((b) => (
                    <option key={b.id} value={b.id}>
                      {formatTime(b.startsAt)} · {b.customerName} · {b.court?.name ?? 'Quadra'}
                    </option>
                  ))}
                </select>
              )}
              <p id={id('booking-hint')} className="mt-1 text-xs text-muted">
                {live.length === 0 && bookings.data
                  ? 'Nenhuma reserva ativa hoje. Use cliente avulso.'
                  : `${live.length} ${plural(live.length, 'reserva ativa', 'reservas ativas')} hoje. O pedido herda o nome do cliente.`}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={id('name')} className="sr-only">
                Nome do cliente
              </label>
              <input
                id={id('name')}
                className="field"
                autoComplete="off"
                placeholder="Nome do cliente (opcional)"
                maxLength={80}
                aria-describedby={id('name-hint')}
                value={customerName}
                onChange={(e) => {
                  setModeChoice((m) => m ?? 'walkin')
                  setCustomerName(e.target.value)
                }}
              />
              <p id={id('name-hint')} className="mt-1 text-xs text-muted">
                Até 80 caracteres.
              </p>
            </div>
          )}
        </fieldset>

        <section aria-label="Escolher itens" className="grid gap-2">
          <label htmlFor={id('search')} className="text-sm font-medium">
            Itens
          </label>
          <input
            id={id('search')}
            type="search"
            className="field"
            autoComplete="off"
            placeholder="Buscar item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-describedby={id('search-hint')}
          />
          <p id={id('search-hint')} className="text-xs text-muted">
            Toque em Adicionar para somar uma unidade. No máximo {MAX_QTY} por item.
          </p>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-line" tabIndex={-1}>
            {products.loading && !products.data ? (
              <ul aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex h-10 items-center border-t border-line-soft px-3 first:border-t-0">
                    <Skeleton className="h-4 w-40" />
                  </li>
                ))}
              </ul>
            ) : products.error || !products.data ? (
              <ErrorState what="os itens" message={products.error?.message} onRetry={products.refetch} />
            ) : active.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Nenhum item ativo. Cadastre itens na página Itens.</p>
            ) : groups.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Nenhum item encontrado para essa busca.</p>
            ) : (
              groups.map((g) => (
                <div key={g.category.id} role="group" aria-label={g.category.name}>
                  <p className="sticky top-0 bg-surface-2 px-3 py-1 text-xs text-muted">
                    {g.category.name}
                  </p>
                  <ul>
                    {g.items.map((p) => (
                      <li
                        key={p.id}
                        className="flex min-h-10 items-center gap-3 border-t border-line-soft px-3 first:border-t-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        {qty[p.id] ? <span className="text-xs text-muted">{qty[p.id]} no pedido</span> : null}
                        <span className={`text-xs ${p.stockQuantity === 0 ? 'text-danger-fg' : 'text-muted'}`}>
                          {p.stockQuantity === 0 ? 'Sem estoque' : `${p.stockQuantity} em estoque`}
                        </span>
                        <span className="text-sm">{formatBRL(p.price)}</span>
                        <button
                          type="button"
                          className="btn-text"
                          aria-label={`Adicionar ${p.name}`}
                          disabled={(qty[p.id] ?? 0) >= Math.min(MAX_QTY, p.stockQuantity)}
                          onClick={() => add(p.id)}
                        >
                          Adicionar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>

        <section aria-label="Itens do pedido">
          <h3 className="mb-1 text-sm font-medium">Itens do pedido</h3>
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-control px-3 py-4 text-center text-sm text-muted">
              Nenhum item adicionado.
            </p>
          ) : (
            <ul>
              {lines.map(({ product: p, quantity, unavailable }) => (
                <li
                  key={p.id}
                  className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-x-3 border-b py-2 ${
                    unavailable ? 'border-danger/60 bg-danger-soft/40' : 'border-line-soft'
                  }`}
                >
                  <div className="min-w-0 leading-5">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[13px] text-muted">
                      {unavailable ? (
                        <span className="text-danger-fg">Item indisponível</span>
                      ) : (
                        <>{formatBRL(p.price)} cada</>
                      )}
                      {' · '}
                      <button type="button" className="btn-text text-[13px]" onClick={() => remove(p.id)}>
                        Remover<span className="sr-only"> {p.name}</span>
                      </button>
                    </p>
                  </div>
                  <div className="flex items-center" role="group" aria-label={`Quantidade de ${p.name}`}>
                    <button
                      type="button"
                      className="btn-ghost w-8 px-0"
                      aria-label={`Diminuir ${p.name}`}
                      disabled={quantity <= 1}
                      onClick={() => sub(p.id)}
                    >
                      <Minus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <output className="w-9 text-center text-sm" aria-live="polite">
                      {quantity}
                    </output>
                    <button
                      type="button"
                      className="btn-ghost w-8 px-0"
                      aria-label={`Aumentar ${p.name}`}
                      disabled={unavailable || quantity >= Math.min(MAX_QTY, p.stockQuantity)}
                      onClick={() => add(p.id)}
                    >
                      <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                  <span className="text-right text-sm">{formatBRL(lineCents(p, quantity) / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4">
          <p className="text-sm text-muted" aria-live="polite">
            {units} {plural(units, 'unidade', 'unidades')}
            <span className="ml-3 text-base font-semibold text-fg">{formatBRL(totalCents / 100)}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-lg" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-lg" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar pedido'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
