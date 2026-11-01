import { describe, expect, it } from 'vitest'
import { parsePrice, priceError } from './price'

describe('parsePrice', () => {
  it('lê formatos pt-BR aceitos', () => {
    expect(parsePrice('12,50')).toBe(12.5)
    expect(parsePrice('12.5')).toBe(12.5)
    expect(parsePrice('R$ 8')).toBe(8)
  })

  it('recusa milhar e mais de 2 casas, em vez de ler errado', () => {
    expect(parsePrice('1.250')).toBeUndefined()
    expect(parsePrice('1.250,00')).toBeUndefined()
    expect(parsePrice('12,3400000001')).toBeUndefined()
  })
})

describe('priceError', () => {
  it('vazio, zero e acima do limite têm mensagem; válido não', () => {
    expect(priceError('')).not.toBe('')
    expect(priceError('0')).not.toBe('')
    expect(priceError('100000,01')).not.toBe('')
    expect(priceError('12,50')).toBe('')
  })
})
