import type { Product } from '@marcai/shared'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, filterItems, isDefaultFilters } from './itemFilter'

const p = (name: string, o: Partial<Product> = {}): Product => ({
  id: name, name, price: 1, costPrice: 1, profitMargin: 0, stockQuantity: 5,
  categoryId: 'c1', categoryName: 'Bebida', active: true, ...o,
})
const items = [
  p('Pastel de Pão'),
  p('Agua', { stockQuantity: 0, categoryId: 'c2' }),
  p('Velho', { active: false, stockQuantity: 0 }),
]
const names = (f: Partial<typeof DEFAULT_FILTERS>) =>
  filterItems(items, { ...DEFAULT_FILTERS, ...f }).map((i) => i.name)

describe('filterItems', () => {
  it('padrão: só ativos', () => expect(names({})).toEqual(['Pastel de Pão', 'Agua']))
  it('texto sem acento, case-insensitive, trim', () => expect(names({ text: '  PAO ' })).toEqual(['Pastel de Pão']))
  it('espaços internos', () => expect(names({ text: 'pastel   de  pao' })).toEqual(['Pastel de Pão']))
  it('categoria', () => expect(names({ categoryId: 'c2' })).toEqual(['Agua']))
  it('situação', () => {
    expect(names({ status: 'in-stock' })).toEqual(['Pastel de Pão'])
    expect(names({ status: 'out-of-stock' })).toEqual(['Agua'])
    expect(names({ status: 'deleted' })).toEqual(['Velho'])
    expect(names({ status: 'all' })).toHaveLength(3)
  })
  it('isDefaultFilters', () => {
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, text: ' ' })).toBe(true)
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, status: 'all' })).toBe(false)
  })
})
