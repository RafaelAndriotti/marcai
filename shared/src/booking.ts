import { z } from "zod";
import { validateBookingInterval } from "./rules.js";
import { bookingStatusSchema, type BookingStatus, type Sport } from "./enums.js";

/** Datas em ISO 8601, price em reais (2 casas). */
export interface Booking {
  id: string;
  courtId: string;
  court?: { id: string; name: string; sport: Sport };
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  price: number;
}

export const createBookingSchema = z
  .object({
    courtId: z.string().min(1),
    customerName: z.string().trim().min(1),
    customerPhone: z.string().trim().min(1),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((v, ctx) => {
    if (Number.isNaN(Date.parse(v.startsAt)) || Number.isNaN(Date.parse(v.endsAt))) return;
    const msg = validateBookingInterval(v.startsAt, v.endsAt);
    if (msg) ctx.addIssue({ code: "custom", message: msg, path: ["endsAt"] });
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingStatusSchema = z.object({
  status: bookingStatusSchema,
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const listBookingsQuerySchema = z.object({
  date: z.iso.date().optional(),
  courtId: z.string().min(1).optional(),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
