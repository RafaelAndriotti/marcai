import { MAX_PRODUCT_PRICE, type CreateProductInput, type Product, type UpdateProductInput } from "@marcai/shared";
import { Prisma, prisma } from "../config/prisma.js";
import { productModel } from "../models/product.model.js";
import { AppError, pgCode } from "../utils/errors.js";

/** Violação de unicidade: P2002 do Prisma ou 23505 do Postgres. */
const isUniqueViolation = (err: unknown): boolean =>
  (err as { code?: unknown } | null)?.code === "P2002" || pgCode(err) === "23505";

/** Forma canônica do nome: trim + NFKC (igual ao schema compartilhado). */
function canonicalName(name: string): string {
  return name.trim().normalize("NFKC");
}

function nameTaken(): AppError {
  return new AppError(409, "PRODUCT_NAME_TAKEN", "Já existe um produto com este nome");
}

/** price = custo * (1 + margem/100), 2 casas HALF_UP; fora de 0.01..MAX_PRODUCT_PRICE vira VALIDATION_ERROR. */
function computePrice(cost: Prisma.Decimal | number, margin: Prisma.Decimal | number): Prisma.Decimal {
  const price = new Prisma.Decimal(cost)
    .mul(new Prisma.Decimal(margin).div(100).add(1))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (price.lt("0.01") || price.gt(MAX_PRODUCT_PRICE)) {
    throw AppError.validation("price", `calculated price must be between 0.01 and ${MAX_PRODUCT_PRICE}`);
  }
  return price;
}

/** FK de categoryId inexistente (P2003 do Prisma ou 23503 do Postgres). */
const isFkViolation = (err: unknown): boolean =>
  (err as { code?: unknown } | null)?.code === "P2003" || pgCode(err) === "23503";

const categoryMissing = () => AppError.validation("categoryId", "category not found");

export const productService = {
  async remove(id: string): Promise<void> {
    if (!(await productModel.deactivate(id))) throw AppError.notFound("Produto não encontrado", { id });
  },

  async create(input: CreateProductInput): Promise<Product> {
    try {
      return await productModel.create({
        ...input,
        name: canonicalName(input.name),
        price: computePrice(input.costPrice, input.profitMargin),
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      if (isFkViolation(err)) throw categoryMissing();
      throw err;
    }
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const data = input.name !== undefined ? { ...input, name: canonicalName(input.name) } : input;
    try {
      return await prisma.$transaction(async (tx) => {
        let price: Prisma.Decimal | undefined;
        if (input.costPrice !== undefined || input.profitMargin !== undefined || input.expectedStockQuantity !== undefined) {
          // campo não enviado: usa o valor atual do banco (linha travada)
          const cur = await productModel.lockPricing(tx, id);
          if (!cur) throw AppError.notFound("Produto não encontrado", { id });
          if (input.expectedStockQuantity !== undefined && cur.stockQuantity !== input.expectedStockQuantity) {
            throw new AppError(409, "STOCK_CHANGED", "O estoque mudou desde que foi carregado", {
              available: cur.stockQuantity,
            });
          }
          if (input.costPrice !== undefined || input.profitMargin !== undefined) price = computePrice(input.costPrice ?? cur.costPrice, input.profitMargin ?? cur.profitMargin);
        }
        return productModel.update(tx, id, { ...data, price });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      if (isFkViolation(err)) throw categoryMissing();
      if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2025") {
        throw AppError.notFound("Produto não encontrado", { id });
      }
      throw err;
    }
  },
};
