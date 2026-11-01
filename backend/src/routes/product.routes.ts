import { Router } from "express";
import { listProducts } from "../controllers/product.controller.js";

export const productRoutes = Router();
productRoutes.get("/", listProducts);
