import type { RequestHandler } from "express";
import type { ApiListResponse, Product } from "@marcai/shared";
import { productModel } from "../models/product.model.js";

export const listProducts: RequestHandler = async (_req, res) => {
  const body: ApiListResponse<Product> = { data: await productModel.list() };
  res.json(body);
};
