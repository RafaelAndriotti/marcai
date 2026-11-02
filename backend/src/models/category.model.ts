import type { Category } from "@marcai/shared";
import { prisma } from "../config/prisma.js";
import type { Tx } from "./booking.model.js";

const toDto = (c: { id: string; name: string }): Category => ({ id: c.id, name: c.name });

export const categoryModel = {
  async list(): Promise<Category[]> {
    const rows = await prisma.category.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
    return rows.map(toDto);
  },

  /** Serializa criações (lock de transação) para o teto valer sob concorrência. */
  async lockCreation(tx: Tx): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('category_create'))`;
  },

  count(tx: Tx): Promise<number> {
    return tx.category.count();
  },

  async create(tx: Tx, name: string): Promise<Category> {
    return toDto(await tx.category.create({ data: { name } }));
  },
};
