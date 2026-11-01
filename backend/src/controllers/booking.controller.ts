import type { RequestHandler } from "express";
import type {
  ApiListResponse,
  ApiResponse,
  Booking,
  CreateBookingInput,
  ListBookingsQuery,
  UpdateBookingStatusInput,
} from "@marcai/shared";
import { bookingService } from "../services/booking.service.js";

export const listBookings: RequestHandler = async (_req, res) => {
  const query = res.locals.query as ListBookingsQuery;
  const body: ApiListResponse<Booking> = { data: await bookingService.list(query) };
  res.json(body);
};

export const createBooking: RequestHandler = async (_req, res) => {
  const input = res.locals.body as CreateBookingInput;
  const body: ApiResponse<Booking> = { data: await bookingService.create(input) };
  res.status(201).json(body);
};

export const updateBookingStatus: RequestHandler<{ id: string }> = async (req, res) => {
  const { status } = res.locals.body as UpdateBookingStatusInput;
  const body: ApiResponse<Booking> = {
    data: await bookingService.updateStatus(req.params.id, status),
  };
  res.json(body);
};
