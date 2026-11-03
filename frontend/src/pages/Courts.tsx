import type { Court } from '@marcai/shared'
import { LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/Skeleton'
import { SportBadge } from '../components/SportBadge'
import { useFetch } from '../hooks/useFetch'
import { formatBRL, plural, today } from '../lib/format'
import { ApiError, deleteCourt, getBookings, getCourts } from '../services/api'
import { CourtModal } from './CourtModal'

const COLS = 'sm:grid-cols-[minmax(0,1fr)_9rem_7rem_8rem_5rem]'

export function Courts() {
  const day = today()
  const { data: all, error, loading, refetch } = useFetch(getCourts, [])
  // Quadras removidas (inativas) não aparecem aqui; seguem na API para o histórico de reservas.
  const data = all?.filter((c) => c.active)
  // Reservas de hoje por quadra; se falhar, a coluna mostra "–".
  const bookings = useFetch(() => getBookings(day), [day])
  const [modal, setModal] = useState(false)
  const [toDelete, setToDelete] = useState<Court | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await deleteCourt(toDelete.id)
      setToDelete(null)
      refetch()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') {
        // já removida em outro lugar: some da lista
        setToDelete(null)
        refetch()
        return
      }
      setDeleteError(
        e instanceof ApiError && (e.code === 'COURT_HAS_FUTURE_BOOKINGS' || e.code === 'NETWORK_ERROR')
          ? e.message
          : 'Não foi possível remover a quadra. Tente novamente.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const description = data
    ? `${data.length} ${plural(data.length, 'quadra', 'quadras')}`
    : error
      ? 'Quadras indisponíveis'
      : undefined

  return (
    <>
      <PageHeader
        title="Quadras"
        description={description ?? <Skeleton className="mt-1.5 h-4 w-40" />}
        actions={
          <button type="button" className="btn-primary" onClick={() => setModal(true)}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Nova quadra
          </button>
        }
      />

      <div
        aria-hidden="true"
        className={`hidden h-9 items-center gap-4 border-b border-line px-2 text-[13px] text-muted sm:grid ${COLS}`}
      >
        <span>Quadra</span>
        <span>Esporte</span>
        <span className="text-right">Preço por hora</span>
        <span className="text-right">Reservas hoje</span>
        <span />
      </div>

      {loading && !data ? (
        <ul aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex h-14 items-center border-b border-line-soft px-2">
              <Skeleton className="h-4 w-48" />
            </li>
          ))}
        </ul>
      ) : error || !data ? (
        <ErrorState what="as quadras" message={error?.message} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma quadra cadastrada"
          description="Cadastre a primeira quadra para receber reservas."
        />
      ) : (
        <ul>
          {data.map((c) => {
            const todayCount = bookings.data?.filter(
              (b) => b.courtId === c.id && b.status !== 'CANCELLED',
            ).length
            return (
              <li
                key={c.id}
                className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-0.5 border-b border-line-soft px-2 py-2 hover:bg-surface-2 ${COLS}`}
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="order-3 flex items-center gap-2 sm:order-none">
                  <SportBadge sport={c.sport} />
                  <span className="text-xs text-muted sm:hidden">
                    {todayCount === undefined ? '–' : todayCount} hoje
                  </span>
                </span>
                <span className="text-right sm:order-none">
                  {formatBRL(c.pricePerHour)}
                  <span className="text-xs text-muted"> /h</span>
                </span>
                <span className="hidden text-right sm:block">
                  {todayCount === undefined ? <span className="text-muted">–</span> : todayCount}
                </span>
                <span className="text-right sm:order-none">
                  <button
                    type="button"
                    className="btn-text text-danger-fg"
                    aria-label={`Remover quadra ${c.name}`}
                    onClick={() => {
                      setDeleteError(undefined)
                      setToDelete(c)
                    }}
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    Remover
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {modal && (
        <CourtModal
          onClose={() => setModal(false)}
          onCreated={() => {
            setModal(false)
            refetch()
          }}
        />
      )}

      {toDelete && (
        <Modal key={toDelete.id} title="Remover quadra" busy={deleting} onClose={() => setToDelete(null)}>
          <div className="grid gap-4">
            {deleteError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg"
              >
                {deleteError}
              </div>
            )}
            <p className="text-sm">Remover {toDelete.name}? Reservas já registradas não mudam.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost btn-lg" disabled={deleting} onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-danger btn-lg" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
