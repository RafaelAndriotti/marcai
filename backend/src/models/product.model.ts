import type { Product } from "@marcai/shared";
import { prisma } from "../config/prisma.js";
import type { Product as DbProduct } from "../../generated/prisma/client.js";

export function toProductDto(p: DbProduct): Product {
  return { id: p.id, name: p.name, price: p.price.toNumber(), active: p.active };
}

export const productModel = {
  async list(): Promise<Product[]> {
    const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
    return rows.map(toProductDto);
  },

  findManyByIds(ids: string[]): Promise<DbProduct[]> {
    return prisma.product.findMany({ where: { id: { in: ids } } });
  },
};
