import { z } from "zod";

/** Maior valor aceito (cabe em Decimal(10,2)). */
export const MAX_MONEY = 99_999_999.99;

/** Reais como number, no máximo 2 casas decimais, 0 <= v <= MAX_MONEY. */
export const moneySchema = z
  .number()
  .nonnegative()
  .finite()
  .max(MAX_MONEY)
  .refine((v) => v === roundMoney(v), {
    message: "must have at most 2 decimal places",
  });

/** Arredonda para 2 casas (reais). */
export function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}
