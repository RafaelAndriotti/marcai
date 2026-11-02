import type { CreateProductInput, ListProductsQuery, Product, UpdateProductInput } from "@marcai/shared";
import { prisma, type Prisma } from "../config/prisma.js";
import type { Category as DbCategory, Product as DbProduct } from "../../generated/prisma/client.js";
import type { Tx } from "./booking.model.js";

function toProductDto(p: DbProduct & { category: DbCategory }): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price.toNumber(),
    costPrice: p.costPrice.toNumber(),
    profitMargin: p.profitMargin.toNumber(),
    stockQuantity: p.stockQuantity,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    active: p.active,
  };
}

export const productModel = {
  async list(query: Partial<ListProductsQuery> = {}): Promise<Product[]> {
    const rows = await prisma.product.findMany({
      where: {
        ...(query.status === "all" ? {} : { active: query.status !== "inactive" }),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      orderBy: { name: "asc" },
      include: { category: true },
    });
    return rows.map(toProductDto);
  },

  async create(input: CreateProductInput & { price: Prisma.Decimal }): Promise<Product> {
    const row = await prisma.product.create({
      data: {
        name: input.name,
        price: input.price,
        costPrice: input.costPrice,
        profitMargin: input.profitMargin,
        stockQuantity: input.stockQuantity,
        categoryId: input.categoryId,
      },
      include: { category: true },
    });
    return toProductDto(row);
  },

  /** Lê custo e margem atuais travando a linha (FOR UPDATE) até o fim da transação. */
  async lockPricing(
    tx: Tx,
    id: string,
  ): Promise<{ costPrice: Prisma.Decimal; profitMargin: Prisma.Decimal; stockQuantity: number } | null> {
    const rows = await tx.$queryRaw<{ costPrice: Prisma.Decimal; profitMargin: Prisma.Decimal; stockQuantity: number }[]>`
      SELECT "costPrice", "profitMargin", "stockQuantity" FROM "Product" WHERE id = ${id} AND active = true FOR UPDATE`;
    return rows[0] ?? null;
  },

  async update(tx: Tx, id: string, input: UpdateProductInput & { price?: Prisma.Decimal }): Promise<Product> {
    // active: true => item excluído não é editável (P2025 -> 404)
    const row = await tx.product.update({
      where: { id, active: true },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
        ...(input.profitMargin !== undefined ? { profitMargin: input.profitMargin } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      },
      include: { category: true },
    });
    return toProductDto(row);
  },

  /** Soft delete atômico: false se não existe ou já está inativo. */
  async deactivate(id: string): Promise<boolean> {
    const { count } = await prisma.product.updateMany({ where: { id, active: true }, data: { active: false } });
    return count > 0;
  },
};
