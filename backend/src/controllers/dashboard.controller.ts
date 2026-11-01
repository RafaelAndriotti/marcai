import type { RequestHandler } from "express";
import type { ApiResponse, DashboardQuery, DashboardSummary } from "@marcai/shared";
import { dashboardService } from "../services/dashboard.service.js";

export const getSummary: RequestHandler = async (_req, res) => {
  const query = res.locals.query as DashboardQuery;
  const body: ApiResponse<DashboardSummary> = { data: await dashboardService.summary(query) };
  res.json(body);
};
