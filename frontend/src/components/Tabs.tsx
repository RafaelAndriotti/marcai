import type { KeyboardEvent } from 'react'

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface Props<T extends string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  panelId: string
}

/** Abas sublinhadas sobre uma régua de 1px; indicador de 2px na cor do texto. */
export function Tabs<T extends string>({ tabs, value, onChange, label, panelId }: Props<T>) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = tabs.findIndex((t) => t.id === value)
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    if (!next) return
    onChange(next.id)
    document.getElementById(`${panelId}-tab-${next.id}`)?.focus()
    e.preventDefault()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-5 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            id={`${panelId}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex h-10 flex-none items-center gap-1.5 border-b-2 text-sm transition-colors ${
              selected
                ? 'border-fg font-medium text-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs text-muted">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
