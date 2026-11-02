import { MAX_CATEGORIES, type Category, type CreateCategoryInput } from "@marcai/shared";
import { prisma } from "../config/prisma.js";
import { categoryModel } from "../models/category.model.js";
import { AppError, pgCode } from "../utils/errors.js";

export const categoryService = {
  async create(input: CreateCategoryInput): Promise<Category> {
    try {
      return await prisma.$transaction(async (tx) => {
        await categoryModel.lockCreation(tx);
        if ((await categoryModel.count(tx)) >= MAX_CATEGORIES) {
          throw new AppError(409, "CATEGORY_LIMIT_REACHED", `Limite de ${MAX_CATEGORIES} categorias atingido`);
        }
        // o schema compartilhado já aplica NFKC + trim
        return categoryModel.create(tx, input.name);
      });
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === "P2002" || pgCode(err) === "23505") {
        throw new AppError(409, "CATEGORY_NAME_TAKEN", "Já existe uma categoria com este nome");
      }
      throw err;
    }
  },
};
