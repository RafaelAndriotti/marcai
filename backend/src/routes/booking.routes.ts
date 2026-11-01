import { Router } from "express";
import {
  createBookingSchema,
  listBookingsQuerySchema,
  updateBookingStatusSchema,
} from "@marcai/shared";
import {
  createBooking,
  listBookings,
  updateBookingStatus,
} from "../controllers/booking.controller.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

export const bookingRoutes = Router();
bookingRoutes.get("/", validateQuery(listBookingsQuerySchema), listBookings);
bookingRoutes.post("/", validateBody(createBookingSchema), createBooking);
bookingRoutes.patch("/:id/status", validateBody(updateBookingStatusSchema), updateBookingStatus);
