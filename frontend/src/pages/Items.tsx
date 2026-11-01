import { PRODUCT_CATEGORY_LABELS, type Product, type ProductCategory } from '@marcai/shared'
import { Package, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { Tabs, type TabItem } from '../components/Tabs'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, plural } from '../lib/format'
import { getProducts } from '../services/api'
import { ProductModal } from './ProductModal'

type Filter = 'ALL' | ProductCategory

const COLS = 'sm:grid-cols-[minmax(0,1fr)_8rem_7rem_6.5rem_4rem]'

export function Items() {
  const [filter, setFilter] = useState<Filter>('ALL')
  // Busca todos uma vez: as contagens das abas vêm das linhas de cada categoria.
  const { data, error, loading, refetch } = useFetch(() => getProducts(), [])
  const [modal, setModal] = useState<{ product?: Product } | null>(null)

  const count = (f: Filter) => (data ? data.filter((p) => f === 'ALL' || p.category === f).length : undefined)
  const tabs: TabItem<Filter>[] = [
    { id: 'ALL', label: 'Todos', count: count('ALL') },
    { id: 'BEBIDA', label: PRODUCT_CATEGORY_LABELS.BEBIDA, count: count('BEBIDA') },
    { id: 'COMIDA', label: PRODUCT_CATEGORY_LABELS.COMIDA, count: count('COMIDA') },
    { id: 'OUTRO', label: PRODUCT_CATEGORY_LABELS.OUTRO, count: count('OUTRO') },
  ]

  const rows = data?.filter((p) => filter === 'ALL' || p.category === filter) ?? []
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
          <button type="button" className="btn-primary" onClick={() => setModal({})}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Novo item
          </button>
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
                  {PRODUCT_CATEGORY_LABELS[p.category]}
                </span>
                <span className="text-right sm:order-none">{formatBRL(p.price)}</span>
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
                    onClick={() => setModal({ product: p })}
                  >
                    Editar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <ProductModal
          product={modal.product}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            refetch()
          }}
        />
      )}
    </>
  )
}
