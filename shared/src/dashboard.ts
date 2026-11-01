import { z } from "zod";
import type { Booking } from "./booking.js";

/** Dia local America/Sao_Paulo; occupancyRate = horas reservadas não canceladas / (quadras ativas x 16h). */
export interface DashboardSummary {
  /** YYYY-MM-DD */
  date: string;
  bookingsCount: number;
  /** 0-1 */
  occupancyRate: number;
  /** Reservas confirmadas/concluídas + pedidos pagos do dia, em reais. */
  revenue: number;
  openOrdersCount: number;
  upcomingBookings: Booking[];
}

export const dashboardQuerySchema = z.object({
  date: z.iso.date().optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
