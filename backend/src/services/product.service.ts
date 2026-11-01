import type { CreateProductInput, Product, UpdateProductInput } from "@marcai/shared";
import { productModel } from "../models/product.model.js";
import { AppError } from "../utils/errors.js";

/** Violação de unicidade: P2002 do Prisma ou 23505 do driver (adapter-pg). */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } }; cause?: { originalCode?: unknown; code?: unknown } };
  return (
    e.code === "P2002" ||
    e.code === "23505" ||
    e.cause?.originalCode === "23505" ||
    e.cause?.code === "23505" ||
    e.meta?.driverAdapterError?.cause?.originalCode === "23505"
  );
}

/** Forma canônica do nome: trim + NFC (igual ao schema compartilhado). */
function canonicalName(name: string): string {
  return name.trim().normalize("NFC");
}

function nameTaken(): AppError {
  return new AppError(409, "PRODUCT_NAME_TAKEN", "Já existe um produto com este nome");
}

export const productService = {
  async create(input: CreateProductInput): Promise<Product> {
    try {
      return await productModel.create({ ...input, name: canonicalName(input.name) });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      throw err;
    }
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    if (!(await productModel.findById(id))) throw AppError.notFound("Produto não encontrado", { id });
    const data = input.name !== undefined ? { ...input, name: canonicalName(input.name) } : input;
    try {
      return await productModel.update(id, data);
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2025") {
        throw AppError.notFound("Produto não encontrado", { id });
      }
      throw err;
    }
  },
};
