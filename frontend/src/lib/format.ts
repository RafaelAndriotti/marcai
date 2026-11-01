import { TIMEZONE, todayLocalDate } from '@marcai/shared'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const hourFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const longDateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const today = (): string => todayLocalDate()

export const formatBRL = (v: number): string => brl.format(v)

export const formatPercent = (v: number): string => `${Math.round(v * 100)}%`

/** "18:30" no fuso do shared. */
export const formatTime = (iso: string): string => hourFmt.format(new Date(iso))

/** "02/11 18:30" no fuso do shared. */
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))

/** "segunda-feira, 2 de novembro de 2026" a partir de YYYY-MM-DD. */
export function formatLongDate(date: string): string {
  return longDateFmt.format(new Date(`${date}T12:00:00Z`))
}

/** Soma dias a YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Minutos desde 00:00 local (fuso do shared) de um instante ISO. */
export function localMinutes(iso: string): number {
  const [h, m] = formatTime(iso).split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** "HH:MM" a partir de minutos. */
export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

const offsetFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  timeZoneName: 'longOffset',
})

/** Offset ("-03:00") do TIMEZONE para a data/hora local informada. */
function offsetFor(date: string, minutes: number): string {
  const guess = new Date(`${date}T${minutesToHHMM(minutes)}:00Z`)
  const name = offsetFmt.formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(name)
  return m ? `${m[1]}:${m[2] ?? '00'}` : '+00:00'
}

/** Monta ISO com offset a partir de data local e minutos desde 00:00. */
export function toIso(date: string, minutes: number): string {
  return `${date}T${minutesToHHMM(minutes)}:00${offsetFor(date, minutes)}`
}
