import type { Product } from '@marcai/shared'

export type StatusFilter = 'active' | 'in-stock' | 'out-of-stock' | 'deleted' | 'all'

export interface ItemFilters {
  text: string
  categoryId: string // '' = todas
  status: StatusFilter
}

export const DEFAULT_FILTERS: ItemFilters = { text: '', categoryId: '', status: 'active' }

export const isDefaultFilters = (f: ItemFilters): boolean =>
  f.text.trim() === '' && f.categoryId === '' && f.status === 'active'

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase()

export function filterItems(items: Product[], f: ItemFilters): Product[] {
  const q = norm(f.text.trim())
  return items.filter((p) => {
    if (q && !norm(p.name).includes(q)) return false
    if (f.categoryId && p.categoryId !== f.categoryId) return false
    switch (f.status) {
      case 'active':
        return p.active
      case 'in-stock':
        return p.active && p.stockQuantity > 0
      case 'out-of-stock':
        return p.active && p.stockQuantity === 0
      case 'deleted':
        return !p.active
      default:
        return true
    }
  })
}
