import { MAX_PRODUCT_PRICE, MAX_PROFIT_MARGIN, MAX_STOCK_QUANTITY } from '@marcai/shared'

const clean = (raw: string): string => raw.trim().replace(/^R\$\s*/i, '').trim()

/**
 * Lê um preço digitado em pt-BR ("12,50", "12.5", "R$ 8"). Devolve reais ou undefined se inválido.
 * Até 2 casas depois do separador: assim "1.250" (milhar) é recusado em vez de virar 1,25.
 */
export function parsePrice(raw: string): number | undefined {
  const s = clean(raw)
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return undefined
  return Number(s.replace(',', '.'))
}

/** Mensagem pt-BR para o campo de preço; vazio quando válido. */
export function priceError(raw: string, label = 'o preço'): string {
  const Cap = label.charAt(0).toUpperCase() + label.slice(1)
  const s = clean(raw)
  if (!s) return `Informe ${label}.`
  if (/^-/.test(s)) return `${Cap} deve ser maior que zero.`
  const n = parsePrice(raw)
  if (n === undefined) return 'Use só números, com vírgula para os centavos. Exemplo: 12,50.'
  if (n <= 0) return `${Cap} deve ser maior que zero.`
  if (n > MAX_PRODUCT_PRICE) return `${Cap} deve ser de no máximo R$ 100.000,00.`
  return ''
}

/** 12.5 vira "12,50" para editar. */
export const priceToInput = (v: number): string => v.toFixed(2).replace('.', ',')

/** Margem em %: 0 a 1000, até 2 casas. Vazio quando válida. */
export function marginError(raw: string): string {
  const n = parsePrice(raw)
  if (n === undefined) return 'Informe a margem em %, com vírgula para decimais. Exemplo: 35,5.'
  if (n > MAX_PROFIT_MARGIN) return 'A margem deve ser de no máximo 1.000%.'
  return ''
}

/** Estoque: inteiro de 0 a 1.000.000. */
export const parseStock = (raw: string): number | undefined => {
  const s = raw.trim()
  return /^\d{1,7}$/.test(s) && Number(s) <= MAX_STOCK_QUANTITY ? Number(s) : undefined
}
export const stockError = (raw: string): string =>
  parseStock(raw) === undefined ? 'Informe um número inteiro de 0 a 1.000.000.' : ''

/** Preço de venda para exibição (centavos, meio para cima). O servidor é a fonte da verdade. */
export function previewPrice(cost: number, margin: number): number {
  return Math.round((Math.round(cost * 100) * (10000 + Math.round(margin * 100))) / 10000) / 100
}
