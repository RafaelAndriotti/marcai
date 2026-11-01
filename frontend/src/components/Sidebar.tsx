import { CalendarDays, House, LayoutGrid, Martini, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { Wordmark } from './Logo'

const NAV = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/quadras', label: 'Quadras', icon: LayoutGrid },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/pedidos', label: 'Pedidos', icon: Martini },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-bg px-3 transition-transform max-lg:border-r max-lg:border-line lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <Wordmark />
          <button
            type="button"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Principal" className="mt-2 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-soft font-medium text-primary-ink'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`size-4 ${isActive ? 'text-primary' : ''}`}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2.5 py-4 text-xs text-muted">Painel da arena</p>
      </aside>
    </>
  )
}
