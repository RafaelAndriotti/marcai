import type { Product } from '@marcai/shared'
import { Package, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { Tabs, type TabItem } from '../components/Tabs'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, formatMargin, plural } from '../lib/format'
import { ApiError, deleteProduct, getCategories, getProducts } from '../services/api'
import { CategoryModal } from './CategoryModal'
import { ProductModal } from './ProductModal'

/** 'ALL' ou o id da categoria. */
type Filter = string

const COLS = 'sm:grid-cols-[minmax(0,1fr)_6.5rem_5rem_6rem_5rem_6rem_6rem_4rem]'

export function Items() {
  const [filter, setFilter] = useState<Filter>('ALL')
  // Busca todos uma vez: as contagens das abas vêm das linhas de cada categoria.
  const { data, error, loading, refetch } = useFetch(() => getProducts(), [])
  const categories = useFetch(() => getCategories(), [])
  const [modal, setModal] = useState<{ product?: Product } | null>(null)
  const [catModal, setCatModal] = useState(false)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await deleteProduct(toDelete.id)
      setToDelete(null)
      refetch()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') {
        // já excluído em outro lugar: some da lista, nada a confirmar
        setToDelete(null)
        refetch()
        return
      }
      setDeleteError(
        e instanceof ApiError && e.code === 'NETWORK_ERROR'
          ? e.message
          : 'Não foi possível excluir o item. Tente novamente.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const count = (f: Filter) => (data ? data.filter((p) => f === 'ALL' || p.categoryId === f).length : undefined)
  const tabs: TabItem<Filter>[] = [
    { id: 'ALL', label: 'Todos', count: count('ALL') },
    ...(categories.data ?? []).map((c) => ({ id: c.id, label: c.name, count: count(c.id) })),
  ]

  const rows = data?.filter((p) => filter === 'ALL' || p.categoryId === filter) ?? []
  const active = rows.filter((p) => p.active).length
  const description = data
    ? rows.length === 0
      ? 'Nenhum item nesta visão'
      : `${rows.length} ${plural(rows.length, 'item', 'itens')}, ${active} ${plural(active, 'ativo', 'ativos')}`
    : error
      ? 'Itens indisponíveis'
      : undefined

  return (
    <>
      <PageHeader
        title="Itens"
        description={description ?? <Skeleton className="mt-1.5 h-4 w-40" />}
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCatModal(true)}>
              Nova categoria
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!categories.data?.length}
              onClick={() => setModal({})}
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Novo item
            </button>
          </>
        }
      />
      <Tabs tabs={tabs} value={filter} onChange={setFilter} label="Categorias dos itens" panelId="items-panel" />

      <div id="items-panel" role="tabpanel" aria-labelledby={`items-panel-tab-${filter}`}>
        <div
          aria-hidden="true"
          className={`hidden h-9 items-center gap-x-4 px-2 text-[13px] text-muted sm:grid ${COLS}`}
        >
          <span>Item</span>
          <span>Categoria</span>
          <span className="text-right">Estoque</span>
          <span className="text-right">Custo</span>
          <span className="text-right">Margem</span>
          <span className="text-right">Preço</span>
          <span>Situação</span>
          <span />
        </div>
        {loading && !data ? (
          <ul aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex h-14 items-center border-b border-line-soft px-2">
                <Skeleton className="h-4 w-56" />
              </li>
            ))}
          </ul>
        ) : categories.error ? (
          <ErrorState what="as categorias" message={categories.error.message} onRetry={categories.refetch} />
        ) : error || !data ? (
          <ErrorState what="os itens" message={error?.message} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filter === 'ALL' ? 'Nenhum item cadastrado' : 'Nenhum item nesta categoria'}
            description={
              filter === 'ALL'
                ? 'Cadastre o primeiro item do bar para registrar pedidos.'
                : 'Escolha outra aba para ver os demais itens.'
            }
          />
        ) : (
          <ul>
            {rows.map((p) => (
              <li
                key={p.id}
                className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-0.5 border-b border-line-soft px-2 py-2 hover:bg-surface-2 ${COLS} ${
                  p.active ? '' : 'text-muted'
                }`}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span className="order-4 col-span-2 text-[13px] text-muted sm:order-none sm:col-auto sm:text-sm sm:text-fg">
                  {p.categoryName}
                </span>
                <span
                  className={`hidden text-right sm:block ${p.stockQuantity === 0 ? 'font-medium text-danger-fg' : ''}`}
                >
                  {p.stockQuantity === 0 ? 'Zerado' : p.stockQuantity}
                </span>
                <span className="hidden text-right sm:block">{formatBRL(p.costPrice)}</span>
                <span className="hidden text-right sm:block">{formatMargin(p.profitMargin)}</span>
                <span className="text-right sm:order-none">{formatBRL(p.price)}</span>
                <span className="order-6 col-span-3 text-[13px] text-muted sm:hidden">
                  Estoque{' '}
                  <span className={p.stockQuantity === 0 ? 'font-medium text-danger-fg' : ''}>
                    {p.stockQuantity === 0 ? 'zerado' : p.stockQuantity}
                  </span>{' '}
                  · Custo {formatBRL(p.costPrice)} · Margem {formatMargin(p.profitMargin)}
                </span>
                <span className="order-5 col-span-2 flex items-center gap-1.5 text-sm sm:order-none sm:col-auto">
                  <span
                    className={`size-1.5 rounded-full ${p.active ? 'bg-primary' : 'bg-control'}`}
                    aria-hidden="true"
                  />
                  {p.active ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-right sm:order-none">
                  <button
                    type="button"
                    className="btn-text"
                    aria-label={`Editar ${p.name}`}
                    disabled={!categories.data}
                    onClick={() => setModal({ product: p })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-text ml-3 text-danger-fg"
                    aria-label={`Excluir ${p.name}`}
                    onClick={() => {
                      setDeleteError(undefined)
                      setToDelete(p)
                    }}
                  >
                    Excluir
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && categories.data && (
        <ProductModal
          product={modal.product}
          categories={categories.data}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            refetch()
          }}
        />
      )}
      {catModal && (
        <CategoryModal
          onClose={() => setCatModal(false)}
          onCreated={(c) => {
            setCatModal(false)
            categories.refetch()
            setFilter(c.id)
          }}
        />
      )}

      {toDelete && (
        <Modal key={toDelete.id} title="Excluir item" busy={deleting} onClose={() => setToDelete(null)}>
          <div className="grid gap-4">
            {deleteError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg"
              >
                {deleteError}
              </div>
            )}
            <p className="text-sm">Excluir {toDelete.name}? Pedidos já registrados não mudam.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost btn-lg" disabled={deleting} onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-danger btn-lg" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
