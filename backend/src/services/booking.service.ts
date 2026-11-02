import {
  type Booking,
  type BookingStatus,
  type CreateBookingInput,
  type ListBookingsQuery,
} from "@marcai/shared";
import { Prisma, prisma } from "../config/prisma.js";
import { bookingModel } from "../models/booking.model.js";
import { localDayRange } from "../utils/date.js";
import { AppError } from "../utils/errors.js";

export const bookingService = {
  list(query: ListBookingsQuery): Promise<Booking[]> {
    return bookingModel.list({
      courtId: query.courtId,
      range: query.date ? localDayRange(query.date) : undefined,
    });
  },

  async create(input: CreateBookingInput): Promise<Booking> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);

    return prisma.$transaction(async (tx) => {
      // serializa criações concorrentes na mesma quadra e lê estado atual
      const court = await bookingModel.lockCourt(tx, input.courtId);
      if (!court) throw AppError.notFound("Quadra não encontrada");
      if (!court.active) throw AppError.validation("courtId", "court is inactive");

      if (await bookingModel.hasConflict(tx, court.id, startsAt, endsAt)) {
        throw AppError.conflict();
      }
      const price = new Prisma.Decimal(court.pricePerHour)
        .mul(minutes)
        .div(60)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      return bookingModel.create(tx, {
        courtId: court.id,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        startsAt,
        endsAt,
        price,
      });
    });
  },

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return prisma.$transaction(async (tx) => {
      const current = await bookingModel.findById(id, tx);
      if (!current) throw AppError.notFound("Reserva não encontrada");

      if (current.status === "CANCELLED" && status !== "CANCELLED") {
        const court = await bookingModel.lockCourt(tx, current.courtId);
        if (!court?.active) throw AppError.validation("courtId", "court is inactive");
        const conflict = await bookingModel.hasConflict(
          tx,
          current.courtId,
          current.startsAt,
          current.endsAt,
          current.id,
        );
        if (conflict) throw AppError.conflict();
      }
      return bookingModel.updateStatus(tx, id, status);
    });
  },
};
