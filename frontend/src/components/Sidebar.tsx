import { CalendarDays, House, LayoutGrid, Martini, Moon, Package, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'
import { Wordmark } from './Logo'

const NAV = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/quadras', label: 'Quadras', icon: LayoutGrid },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/pedidos', label: 'Pedidos', icon: Martini },
  { to: '/itens', label: 'Itens', icon: Package },
]

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const next = theme === 'dark' ? 'light' : 'dark'
  const Icon = next === 'light' ? Sun : Moon
  return (
    <button
      type="button"
      className="ml-auto grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
      onClick={() => {
        document.documentElement.dataset.theme = next
        try {
          localStorage.setItem('theme', next)
        } catch {
          // sem storage: vale só nesta aba
        }
        setTheme(next)
      }}
      aria-label={next === 'light' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={next === 'light' ? 'Tema claro' : 'Tema escuro'}
    >
      <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}

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
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-bg px-3 transition-transform lg:translate-x-0 ${
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
                `flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-2 font-medium text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 px-2.5 py-4">
          <span
            className="grid size-8 place-items-center rounded-full bg-surface-2 text-sm font-medium"
            aria-hidden="true"
          >
            A
          </span>
          <div className="leading-4">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted">Painel da arena</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}
