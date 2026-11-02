import { Router } from "express";
import { createCategorySchema } from "@marcai/shared";
import { createCategory, listCategories } from "../controllers/category.controller.js";
import { validateBody } from "../middleware/validate.js";

export const categoryRoutes = Router();
categoryRoutes.get("/", listCategories);
categoryRoutes.post("/", validateBody(createCategorySchema), createCategory);
