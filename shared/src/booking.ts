import { z } from "zod";
import { safeNameSchema } from "./category.js";
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
    customerName: safeNameSchema(80),
    customerPhone: z.string().trim().regex(/^[0-9 ()+-]{8,20}$/, "Telefone inválido")
      .refine((s) => (s.match(/\d/g) ?? []).length >= 8, "Telefone inválido"),
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
