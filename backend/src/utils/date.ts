import { toLocalParts } from "@marcai/shared";

const DAY_MS = 86_400_000;

function parseYmd(date: string): [number, number, number] {
  return date.split("-").map(Number) as [number, number, number];
}

/** Instante UTC em que o dia local `date` (YYYY-MM-DD, America/Sao_Paulo) começa. */
function localMidnightUtc(date: string): Date {
  const [y, m, d] = parseYmd(date);
  const targetMs = Date.UTC(y, m - 1, d);
  let guess = targetMs; // chute inicial: offset 0; corrige pelo offset real via Intl
  for (let i = 0; i < 3; i++) {
    const p = toLocalParts(new Date(guess));
    const [py, pm, pd] = parseYmd(p.date);
    const localMs = Date.UTC(py, pm - 1, pd) + p.minutes * 60_000;
    const diff = targetMs - localMs;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** Intervalo UTC [start, end) cobrindo o dia local. */
export function localDayRange(date: string): { start: Date; end: Date } {
  const [y, m, d] = parseYmd(date);
  const next = new Date(Date.UTC(y, m - 1, d) + DAY_MS).toISOString().slice(0, 10);
  return { start: localMidnightUtc(date), end: localMidnightUtc(next) };
}
