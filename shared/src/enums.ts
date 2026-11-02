import { z } from "zod";

export const SPORTS = ["VOLEI", "BEACH_TENNIS", "FUTEVOLEI"] as const;
export const sportSchema = z.enum(SPORTS);
export type Sport = z.infer<typeof sportSchema>;
export const SPORT_LABELS: Record<Sport, string> = {
  VOLEI: "Vôlei",
  BEACH_TENNIS: "Beach Tennis",
  FUTEVOLEI: "Futevôlei",
};

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "DONE"] as const;
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  DONE: "Concluída",
};

export const ORDER_STATUSES = ["OPEN", "PAID", "CANCELLED"] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: "Aberto",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};
