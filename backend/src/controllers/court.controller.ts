import type { RequestHandler } from "express";
import type { ApiListResponse, ApiResponse, Court, CreateCourtInput } from "@marcai/shared";
import { courtModel } from "../models/court.model.js";

export const listCourts: RequestHandler = async (_req, res) => {
  const body: ApiListResponse<Court> = { data: await courtModel.list() };
  res.json(body);
};

export const createCourt: RequestHandler = async (_req, res) => {
  const input = res.locals.body as CreateCourtInput;
  const body: ApiResponse<Court> = { data: await courtModel.create(input) };
  res.status(201).json(body);
};
