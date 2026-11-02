import { z } from "zod";
import { safeNameSchema } from "./category.js";
import { moneySchema } from "./money.js";

export interface Product {
  id: string;
  name: string;
  /** Preço de venda, calculado no backend: costPrice * (1 + profitMargin/100). */
  price: number;
  costPrice: number;
  /** Margem de lucro em % (35.5 = 35,5%). */
  profitMargin: number;
  stockQuantity: number;
  categoryId: string;
  categoryName: string;
  active: boolean;
}

/** Teto de negócio do preço de produto (reais). */
export const MAX_PRODUCT_PRICE = 100_000;

const productNameSchema = safeNameSchema(80);
/** Valor de compra: reais, até 2 casas, > 0. O preço de venda resultante é validado no backend. */
const costPriceSchema = moneySchema.positive();
/** Margem em %: 0 a 1000, até 2 casas. */
export const MAX_PROFIT_MARGIN = 1000;
const profitMarginSchema = moneySchema.max(MAX_PROFIT_MARGIN);
export const MAX_STOCK_QUANTITY = 1_000_000;
const stockQuantitySchema = z.number().int().min(0).max(MAX_STOCK_QUANTITY);

export const createProductSchema = z.object({
  name: productNameSchema,
  costPrice: costPriceSchema,
  profitMargin: profitMarginSchema,
  stockQuantity: stockQuantitySchema,
  categoryId: z.string().min(1),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: productNameSchema.optional(),
    costPrice: costPriceSchema.optional(),
    profitMargin: profitMarginSchema.optional(),
    stockQuantity: stockQuantitySchema.optional(),
    /** Trava otimista: só aplica se o estoque atual for este valor (senão 409 STOCK_CHANGED). */
    expectedStockQuantity: z.number().int().min(0).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "at least one field must be provided",
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
