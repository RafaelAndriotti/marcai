import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

export const api = () => request(app);

export const day = "2027-03-10";
/** Instante local São Paulo (-03:00) no dia fixo. */
export const at = (hhmm: string, d = day) => `${d}T${hhmm}:00-03:00`;

export function makeCourt(
  data: Partial<{ name: string; pricePerHour: string; active: boolean }> = {},
) {
  return prisma.court.create({
    data: { name: "Quadra 1", sport: "VOLEI", pricePerHour: "80.00", active: true, ...data },
  });
}

export function makeProduct(data: Partial<{ name: string; price: string; active: boolean }> = {}) {
  return prisma.product.create({ data: { name: "Agua", price: "5.00", active: true, ...data } });
}

export function bookingBody(courtId: string, start: string, end: string, extra = {}) {
  return {
    courtId,
    customerName: "Ana",
    customerPhone: "11999990000",
    startsAt: at(start),
    endsAt: at(end),
    ...extra,
  };
}
