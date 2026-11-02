import { z } from "zod";

export interface Category {
  id: string;
  name: string;
}

/** Normaliza para NFKC primeiro (funde formas de compatibilidade), depois valida (limite vale para o nome normalizado). */
export const safeNameSchema = (max: number) =>
  z
    .string()
    .transform((s) => s.normalize("NFKC"))
    .pipe(
      z
        .string()
        .trim()
        .min(1)
        .max(max)
        // controle, formatação, separadores de linha/parágrafo, "brancos" que renderizam vazios e pilhas de marcas combinantes
        .refine((s) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u3164\u2800\u115F\u1160\uFFA0]|\p{M}{3,}/u.test(s), {
          message: "must not contain control or invisible formatting characters",
        }),
    );

const MAX_CATEGORY_NAME = 40;
/** Teto de categorias (POST /categories -> 409 CATEGORY_LIMIT_REACHED). */
export const MAX_CATEGORIES = 50;
export const createCategorySchema = z.object({ name: safeNameSchema(MAX_CATEGORY_NAME) });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
