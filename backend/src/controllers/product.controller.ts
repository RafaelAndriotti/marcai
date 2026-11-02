import type { RequestHandler } from "express";
import type {
  ApiListResponse,
  ApiResponse,
  CreateProductInput,
  ListProductsQuery,
  Product,
  UpdateProductInput,
} from "@marcai/shared";
import { productModel } from "../models/product.model.js";
import { productService } from "../services/product.service.js";

export const listProducts: RequestHandler = async (_req, res) => {
  const query = res.locals.query as ListProductsQuery;
  const body: ApiListResponse<Product> = { data: await productModel.list(query) };
  res.json(body);
};

export const createProduct: RequestHandler = async (_req, res) => {
  const input = res.locals.body as CreateProductInput;
  const body: ApiResponse<Product> = { data: await productService.create(input) };
  res.status(201).json(body);
};

export const deleteProduct: RequestHandler = async (req, res) => {
  await productService.remove(String(req.params.id));
  res.status(204).end();
};

export const updateProduct: RequestHandler = async (req, res) => {
  const input = res.locals.body as UpdateProductInput;
  const body: ApiResponse<Product> = { data: await productService.update(String(req.params.id), input) };
  res.json(body);
};
