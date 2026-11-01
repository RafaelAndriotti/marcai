import { MAX_PRODUCT_PRICE } from '@marcai/shared'

const clean = (raw: string): string => raw.trim().replace(/^R\$\s*/i, '').trim()

/**
 * Lê um preço digitado em pt-BR ("12,50", "12.5", "R$ 8"). Devolve reais ou undefined se inválido.
 * Milhar não é aceito, para não confundir "1.250" com 1,25. Zeros além da 2ª casa ("12,500") são aceitos.
 */
export function parsePrice(raw: string): number | undefined {
  const s = clean(raw)
  if (!/^\d+([.,]\d+)?$/.test(s)) return undefined
  return Number(s.replace(',', '.'))
}

/** Mensagem pt-BR para o campo de preço; vazio quando válido. */
export function priceError(raw: string): string {
  const s = clean(raw)
  if (!s) return 'Informe o preço.'
  if (/^-/.test(s)) return 'O preço deve ser maior que zero.'
  const n = parsePrice(raw)
  if (n === undefined) return 'Use só números, com vírgula para os centavos. Exemplo: 12,50.'
  if (n <= 0) return 'O preço deve ser maior que zero.'
  if (n > MAX_PRODUCT_PRICE) return 'O preço deve ser de no máximo R$ 100.000,00.'
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return 'Use no máximo 2 casas decimais.'
  return ''
}

/** 12.5 vira "12,50" para editar. */
export const priceToInput = (v: number): string => v.toFixed(2).replace('.', ',')
