import { Router } from "express";
import { createCourtSchema } from "@marcai/shared";
import { createCourt, deleteCourt, listCourts } from "../controllers/court.controller.js";
import { validateBody } from "../middleware/validate.js";

export const courtRoutes = Router();
courtRoutes.get("/", listCourts);
courtRoutes.post("/", validateBody(createCourtSchema), createCourt);
courtRoutes.delete("/:id", deleteCourt);
