import { z } from "zod";
import { productCategorySchema, type ProductCategory } from "./enums.js";
import { moneySchema, roundMoney } from "./money.js";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  active: boolean;
}

/** Teto de negócio do preço de produto (reais). */
export const MAX_PRODUCT_PRICE = 100_000;

/** Normaliza para NFC primeiro, depois valida (limite vale para o nome normalizado). */
const productNameSchema = z
  .string()
  .transform((s) => s.normalize("NFC"))
  .pipe(
    z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((s) => !/[\p{Cc}\p{Cf}]/u.test(s), {
        message: "must not contain control or invisible formatting characters",
      }),
  );
/** Preço de venda: reais, até 2 casas, 0.01 a MAX_PRODUCT_PRICE. */
const productPriceSchema = moneySchema
  .refine((v) => roundMoney(v) > 0, { message: "must be greater than 0" })
  .refine((v) => v <= MAX_PRODUCT_PRICE, {
    message: `must be at most ${MAX_PRODUCT_PRICE}`,
  });

export const createProductSchema = z.object({
  name: productNameSchema,
  price: productPriceSchema,
  category: productCategorySchema,
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: productNameSchema.optional(),
    price: productPriceSchema.optional(),
    category: productCategorySchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field must be provided",
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  category: productCategorySchema.optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
