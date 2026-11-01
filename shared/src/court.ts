import { z } from "zod";
import { moneySchema } from "./money.js";
import { sportSchema, type Sport } from "./enums.js";

/** Resposta da API. pricePerHour em reais (2 casas). */
export interface Court {
  id: string;
  name: string;
  sport: Sport;
  pricePerHour: number;
  active: boolean;
}

export const createCourtSchema = z.object({
  name: z.string().trim().min(1),
  sport: sportSchema,
  pricePerHour: moneySchema,
  active: z.boolean().optional(),
});
export type CreateCourtInput = z.infer<typeof createCourtSchema>;
