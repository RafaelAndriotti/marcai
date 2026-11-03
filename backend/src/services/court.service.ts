import { prisma } from "../config/prisma.js";
import { bookingModel } from "../models/booking.model.js";
import { courtModel } from "../models/court.model.js";
import { AppError } from "../utils/errors.js";

export const courtService = {
  /** Soft delete. A trava da linha da quadra serializa com a criação de reservas (mesma trava). */
  async remove(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const court = await bookingModel.lockCourt(tx, id);
      if (!court?.active) throw AppError.notFound("Quadra não encontrada", { id });
      if (await bookingModel.hasUpcoming(tx, id, new Date())) {
        throw new AppError(
          409,
          "COURT_HAS_FUTURE_BOOKINGS",
          "Esta quadra tem reservas futuras ou em andamento. Cancele-as antes de remover a quadra.",
        );
      }
      await courtModel.deactivate(tx, id);
    });
  },
};
