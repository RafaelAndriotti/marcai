import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { Wordmark } from './Logo'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-60">
        <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg px-2 lg:hidden">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-fg hover:bg-surface-2"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
            aria-controls="sidebar"
          >
            <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
          <Wordmark />
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
