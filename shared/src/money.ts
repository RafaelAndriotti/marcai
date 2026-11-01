import { z } from "zod";

/** Reais como number, no máximo 2 casas decimais, >= 0. */
export const moneySchema = z
  .number()
  .nonnegative()
  .finite()
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, {
    message: "must have at most 2 decimal places",
  });

/** Arredonda para 2 casas (reais). */
export function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}
