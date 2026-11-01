import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, at, bookingBody, day, makeCourt } from "./helpers.js";

async function book(courtId: string, s: string, e: string, status?: string) {
  const res = await api().post("/api/bookings").send(bookingBody(courtId, s, e));
  expect(res.status).toBe(201);
  if (status) {
    await api().patch(`/api/bookings/${res.body.data.id}/status`).send({ status });
  }
  return res.body.data;
}

describe("GET /api/dashboard/summary", () => {
  it("fixture conhecida", async () => {
    const c1 = await makeCourt({ name: "A", pricePerHour: "80.00" });
    await makeCourt({ name: "B", pricePerHour: "100.00" });
    await makeCourt({ name: "Inativa", active: false });

    await book(c1.id, "10:00", "12:00", "CONFIRMED"); // 160, 2h
    await book(c1.id, "14:00", "15:30", "DONE"); // 120, 1.5h
    await book(c1.id, "16:00", "17:00"); // PENDING: conta, sem receita, 1h
    await book(c1.id, "18:00", "19:00", "CANCELLED"); // não conta
    // outro dia: não conta
    await api()
      .post("/api/bookings")
      .send({
        ...bookingBody(c1.id, "10:00", "11:00"),
        startsAt: at("10:00", "2027-03-11"),
        endsAt: at("11:00", "2027-03-11"),
      });

    // PAID do dia, PAID de outro dia, 2 OPEN (um em outro dia: conta mesmo assim)
    await prisma.order.create({
      data: { total: "17.50", status: "PAID", createdAt: new Date(at("20:00")) },
    });
    await prisma.order.create({
      data: { total: "99.00", status: "PAID", createdAt: new Date(at("20:00", "2027-03-11")) },
    });
    await prisma.order.create({ data: { total: "5.00", status: "OPEN" } });
    await prisma.order.create({
      data: { total: "5.00", status: "OPEN", createdAt: new Date(at("09:00", "2027-03-11")) },
    });

    const res = await api().get(`/api/dashboard/summary?date=${day}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.date).toBe(day);
    expect(d.bookingsCount).toBe(3);
    expect(d.revenue).toBe(160 + 120 + 17.5);
    expect(d.openOrdersCount).toBe(2);
    // 4.5h / (2 quadras ativas x 16h)
    expect(d.occupancyRate).toBeCloseTo(4.5 / 32, 4);
    expect(d.upcomingBookings.map((b: { startsAt: string }) => Date.parse(b.startsAt))).toEqual([
      Date.parse(at("10:00")),
      Date.parse(at("14:00")),
      Date.parse(at("16:00")),
    ]);
  });

  it("banco vazio: zeros", async () => {
    const res = await api().get(`/api/dashboard/summary?date=${day}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      bookingsCount: 0,
      revenue: 0,
      openOrdersCount: 0,
      occupancyRate: 0,
      upcomingBookings: [],
    });
  });

  it("sem date usa hoje; date inválida -> 400", async () => {
    const ok = await api().get("/api/dashboard/summary");
    expect(ok.status).toBe(200);
    expect(ok.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await api().get("/api/dashboard/summary?date=abc")).status).toBe(400);
  });
});
