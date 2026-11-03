/** Regras de negócio compartilhadas (backend valida, frontend pode pré-validar). */

export const TIMEZONE = "America/Sao_Paulo";

/** Horário de funcionamento (07:00-23:00), em minutos locais de TIMEZONE. */
const BUSINESS_HOURS_MINUTES = { open: 7 * 60, close: 23 * 60 } as const;
/** Horas funcionais por dia (usado no occupancyRate). */
export const BUSINESS_HOURS_PER_DAY = (BUSINESS_HOURS_MINUTES.close - BUSINESS_HOURS_MINUTES.open) / 60;

export const BOOKING_DURATION = {
  minMinutes: 60,
  stepMinutes: 60,
  maxMinutes: 240,
} as const;

const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data (YYYY-MM-DD) e minutos desde 00:00 locais em America/Sao_Paulo. */
export function toLocalParts(d: Date): { date: string; minutes: number } {
  const p: Record<string, string> = {};
  for (const part of localFormatter.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Dia local atual (YYYY-MM-DD) em America/Sao_Paulo. */
export function todayLocalDate(now: Date = new Date()): string {
  return toLocalParts(now).date;
}

/** Retorna mensagem de erro ou null se o intervalo é uma reserva válida. */
export function validateBookingInterval(startsAt: string, endsAt: string): string | null {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const durationMin = (e.getTime() - s.getTime()) / 60_000;
  if (!(durationMin > 0)) return "endsAt must be after startsAt";
  if (durationMin < BOOKING_DURATION.minMinutes) return "duration must be at least 1 hour";
  if (durationMin > BOOKING_DURATION.maxMinutes) return "duration must be at most 4 hours";
  if (durationMin % BOOKING_DURATION.stepMinutes !== 0) {
    return "duration must be a multiple of 1 hour (whole hours)";
  }
  if (s.getTime() % 60_000 !== 0) return "startsAt must have zero seconds and milliseconds";
  const ls = toLocalParts(s);
  if (ls.minutes % BOOKING_DURATION.stepMinutes !== 0) {
    return "startsAt must be on a full hour (:00)";
  }
  const le = toLocalParts(e);
  if (ls.date !== le.date) return "booking must start and end on the same local day";
  if (ls.minutes < BUSINESS_HOURS_MINUTES.open || le.minutes > BUSINESS_HOURS_MINUTES.close) {
    return "booking must be within business hours (07:00-23:00)";
  }
  return null;
}
