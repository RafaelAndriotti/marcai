import type { CreateProductInput, ListProductsQuery, Product, UpdateProductInput } from "@marcai/shared";
import { prisma } from "../config/prisma.js";
import type { Product as DbProduct } from "../../generated/prisma/client.js";

export function toProductDto(p: DbProduct): Product {
  return { id: p.id, name: p.name, price: p.price.toNumber(), category: p.category, active: p.active };
}

export const productModel = {
  async list(query: ListProductsQuery = {}): Promise<Product[]> {
    const rows = await prisma.product.findMany({
      where: query.category ? { category: query.category } : undefined,
      orderBy: { name: "asc" },
    });
    return rows.map(toProductDto);
  },

  async create(input: CreateProductInput): Promise<Product> {
    const row = await prisma.product.create({
      data: { name: input.name, price: input.price, category: input.category },
    });
    return toProductDto(row);
  },

  findById(id: string): Promise<DbProduct | null> {
    return prisma.product.findUnique({ where: { id } });
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const row = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return toProductDto(row);
  },

  findManyByIds(ids: string[]): Promise<DbProduct[]> {
    return prisma.product.findMany({ where: { id: { in: ids } } });
  },
};
