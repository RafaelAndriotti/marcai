import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, bookingBody, makeCourt } from "./helpers.js";

describe("courts", () => {
  it("lista quadras ordenadas por nome, incluindo inativas", async () => {
    await makeCourt({ name: "B", pricePerHour: "90.50" });
    await makeCourt({ name: "A", active: false });
    const res = await api().get("/api/courts");
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(["A", "B"]);
    expect(res.body.data[1]).toMatchObject({ pricePerHour: 90.5, active: true, sport: "VOLEI" });
  });

  it("cria quadra (201) com active default true", async () => {
    const res = await api()
      .post("/api/courts")
      .send({ name: "  Areia 2 ", sport: "BEACH_TENNIS", pricePerHour: 90.5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Areia 2",
      sport: "BEACH_TENNIS",
      pricePerHour: 90.5,
      active: true,
    });
    expect(typeof res.body.data.id).toBe("string");
  });

  it.each([
    ["nome vazio", { name: " ", sport: "VOLEI", pricePerHour: 10 }, "name"],
    ["sport inválido", { name: "X", sport: "TENIS", pricePerHour: 10 }, "sport"],
    ["preço negativo", { name: "X", sport: "VOLEI", pricePerHour: -1 }, "pricePerHour"],
    ["3 casas decimais", { name: "X", sport: "VOLEI", pricePerHour: 10.123 }, "pricePerHour"],
    ["sem preço", { name: "X", sport: "VOLEI" }, "pricePerHour"],
  ])("validação: %s -> 400", async (_n, body, path) => {
    const res = await api().post("/api/courts").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });
});

describe("DELETE /api/courts/:id", () => {
  afterEach(() => vi.useRealTimers());

  it("inexistente ou já removida -> 404", async () => {
    const c = await makeCourt();
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(204);
    for (const id of [c.id, "nope"]) {
      const res = await api().delete(`/api/courts/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("reserva futura não cancelada -> 409 e quadra segue ativa; cancelada libera", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2027-03-01T12:00:00Z") });
    const c = await makeCourt();
    const b = await api().post("/api/bookings").send(bookingBody(c.id, "10:00", "11:00"));
    expect(b.status).toBe(201);
    const res = await api().delete(`/api/courts/${c.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("COURT_HAS_FUTURE_BOOKINGS");
    expect((await prisma.court.findUniqueOrThrow({ where: { id: c.id } })).active).toBe(true);

    await api().patch(`/api/bookings/${b.body.data.id}/status`).send({ status: "CANCELLED" });
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(204);
  });

  it("sucesso: 204, soft delete mantém a linha e o histórico", async () => {
    const c = await makeCourt();
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(204);
    expect((await prisma.court.findUniqueOrThrow({ where: { id: c.id } })).active).toBe(false);
  });
});

describe("DELETE /api/courts/:id (relógio fixo)", () => {
  afterEach(() => vi.useRealTimers());
  // day = 2027-03-10; reserva 10:00-11:00 (-03:00) = 13:00-14:00Z
  const clockAt = (iso: string) => vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });

  it("reserva futura -> 409", async () => {
    clockAt("2027-03-01T12:00:00Z");
    const c = await makeCourt();
    expect((await api().post("/api/bookings").send(bookingBody(c.id, "10:00", "11:00"))).status).toBe(201);
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(409);
  });

  it("reserva em andamento -> 409", async () => {
    clockAt("2027-03-01T12:00:00Z");
    const c = await makeCourt();
    expect((await api().post("/api/bookings").send(bookingBody(c.id, "10:00", "11:00"))).status).toBe(201);
    vi.setSystemTime(new Date("2027-03-10T13:30:00Z"));
    const res = await api().delete(`/api/courts/${c.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("COURT_HAS_FUTURE_BOOKINGS");
  });

  it("reserva já terminada -> 204", async () => {
    clockAt("2027-03-01T12:00:00Z");
    const c = await makeCourt();
    expect((await api().post("/api/bookings").send(bookingBody(c.id, "10:00", "11:00"))).status).toBe(201);
    vi.setSystemTime(new Date("2027-03-10T15:00:00Z"));
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(204);
  });

  it("reativar reserva cancelada depois de remover a quadra -> 400", async () => {
    clockAt("2027-03-01T12:00:00Z");
    const c = await makeCourt();
    const b = await api().post("/api/bookings").send(bookingBody(c.id, "10:00", "11:00"));
    const url = `/api/bookings/${b.body.data.id}/status`;
    await api().patch(url).send({ status: "CANCELLED" });
    expect((await api().delete(`/api/courts/${c.id}`)).status).toBe(204);
    const res = await api().patch(url).send({ status: "CONFIRMED" });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe("courtId");
  });
});
