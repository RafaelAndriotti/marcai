import { Router } from "express";
import { createOrderSchema, listOrdersQuerySchema } from "@marcai/shared";
import { createOrder, listOrders } from "../controllers/order.controller.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

export const orderRoutes = Router();
orderRoutes.get("/", validateQuery(listOrdersQuerySchema), listOrders);
orderRoutes.post("/", validateBody(createOrderSchema), createOrder);
