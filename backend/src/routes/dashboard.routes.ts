import { Router } from "express";
import { dashboardQuerySchema } from "@marcai/shared";
import { getSummary } from "../controllers/dashboard.controller.js";
import { validateQuery } from "../middleware/validate.js";

export const dashboardRoutes = Router();
dashboardRoutes.get("/summary", validateQuery(dashboardQuerySchema), getSummary);
