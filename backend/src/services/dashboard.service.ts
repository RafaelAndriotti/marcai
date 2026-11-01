import {
  BUSINESS_HOURS_PER_DAY,
  roundMoney,
  todayLocalDate,
  type DashboardQuery,
  type DashboardSummary,
} from "@marcai/shared";
import { bookingModel } from "../models/booking.model.js";
import { courtModel } from "../models/court.model.js";
import { orderModel } from "../models/order.model.js";
import { localDayRange } from "../utils/date.js";

export const dashboardService = {
  async summary(query: DashboardQuery): Promise<DashboardSummary> {
    const now = new Date();
    const date = query.date ?? todayLocalDate(now);
    const range = localDayRange(date);

    const [active, activeCourtList, openOrdersCount, bookingRevenue, orderRevenue] =
      await Promise.all([
        bookingModel.listActiveInRange(range),
        courtModel.listActiveIds(),
        orderModel.countOpen(),
        bookingModel.sumPriceByStatus(range, ["CONFIRMED", "DONE"]),
        orderModel.sumPaidTotal(range),
      ]);

    const activeCourtIds = new Set(activeCourtList);
    const activeCourts = activeCourtList.length;
    const bookedHours = active
      .filter((b) => activeCourtIds.has(b.courtId))
      .reduce(
      (sum, b) => sum + (Date.parse(b.endsAt) - Date.parse(b.startsAt)) / 3_600_000,
      0,
    );
    const capacity = activeCourts * BUSINESS_HOURS_PER_DAY;
    const occupancyRate = capacity > 0 ? Math.min(1, bookedHours / capacity) : 0;

    return {
      date,
      bookingsCount: active.length,
      occupancyRate: Math.round(occupancyRate * 10_000) / 10_000,
      revenue: roundMoney(bookingRevenue + orderRevenue),
      openOrdersCount,
      upcomingBookings: active.filter((b) => Date.parse(b.endsAt) > now.getTime()).slice(0, 10),
    };
  },
};
