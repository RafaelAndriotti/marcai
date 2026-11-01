import { Router } from "express";
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from "@marcai/shared";
import { createProduct, listProducts, updateProduct } from "../controllers/product.controller.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

export const productRoutes = Router();
productRoutes.get("/", validateQuery(listProductsQuerySchema), listProducts);
productRoutes.post("/", validateBody(createProductSchema), createProduct);
productRoutes.patch("/:id", validateBody(updateProductSchema), updateProduct);
