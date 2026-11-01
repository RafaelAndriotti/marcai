import type { RequestHandler } from "express";
import type { ApiResponse, HealthStatus } from "@marcai/shared";

export const health: RequestHandler = (_req, res) => {
  const body: ApiResponse<HealthStatus> = { data: { status: "ok" } };
  res.json(body);
};
