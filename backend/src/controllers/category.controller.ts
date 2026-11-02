import type { RequestHandler } from "express";
import type { ApiListResponse, ApiResponse, Category, CreateCategoryInput } from "@marcai/shared";
import { categoryModel } from "../models/category.model.js";
import { categoryService } from "../services/category.service.js";

export const listCategories: RequestHandler = async (_req, res) => {
  const body: ApiListResponse<Category> = { data: await categoryModel.list() };
  res.json(body);
};

export const createCategory: RequestHandler = async (_req, res) => {
  const input = res.locals.body as CreateCategoryInput;
  const body: ApiResponse<Category> = { data: await categoryService.create(input) };
  res.status(201).json(body);
};
