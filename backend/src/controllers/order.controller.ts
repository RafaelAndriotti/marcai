import type { RequestHandler } from "express";
import type {
  ApiListResponse,
  ApiResponse,
  CreateOrderInput,
  ListOrdersQuery,
  Order,
} from "@marcai/shared";
import { orderService } from "../services/order.service.js";

export const listOrders: RequestHandler = async (_req, res) => {
  const query = res.locals.query as ListOrdersQuery;
  const body: ApiListResponse<Order> = { data: await orderService.list(query) };
  res.json(body);
};

export const createOrder: RequestHandler = async (_req, res) => {
  const input = res.locals.body as CreateOrderInput;
  const body: ApiResponse<Order> = { data: await orderService.create(input) };
  res.status(201).json(body);
};
