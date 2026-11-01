import { describe, expect, it } from "vitest";
import { api, at, bookingBody, day, makeCourt } from "./helpers.js";

async function create(courtId: string, s: string, e: string, extra = {}) {
  return api().post("/api/bookings").send(bookingBody(courtId, s, e, extra));
}

describe("POST /api/bookings", () => {
  it("cria com price calculado e status PENDING", async () => {
    const court = await makeCourt({ pricePerHour: "80.00" });
    const res = await create(court.id, "18:00", "19:30");
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      courtId: court.id,
      status: "PENDING",
      price: 120,
      customerName: "Ana",
    });
    expect(Date.parse(res.body.data.startsAt)).toBe(Date.parse(at("18:00")));
  });

  it("ignora price enviado", async () => {
    const court = await makeCourt();
    const res = await create(court.id, "10:00", "11:00", { price: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(80);
  });

  it("Decimal 90.55/h x 1.5h = 135.83", async () => {
    const court = await makeCourt({ pricePerHour: "90.55" });
    const res = await create(court.id, "09:00", "10:30");
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(135.83);
  });

  it("sobreposição -> 409 BOOKING_CONFLICT", async () => {
    const court = await makeCourt();
    expect((await create(court.id, "18:00", "19:00")).status).toBe(201);
    const res = await create(court.id, "18:30", "19:30");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_CONFLICT");
  });

  it("intervalo contido em outro -> 409", async () => {
    const court = await makeCourt();
    await create(court.id, "10:00", "13:00");
    expect((await create(court.id, "11:00", "11:30")).status).toBe(409);
  });

  it("adjacente (fim = início) não conflita", async () => {
    const court = await makeCourt();
    expect((await create(court.id, "18:00", "19:00")).status).toBe(201);
    expect((await create(court.id, "19:00", "20:00")).status).toBe(201);
    expect((await create(court.id, "17:00", "18:00")).status).toBe(201);
  });

  it("outra quadra no mesmo horário não conflita", async () => {
    const a = await makeCourt({ name: "A" });
    const b = await makeCourt({ name: "B" });
    expect((await create(a.id, "18:00", "19:00")).status).toBe(201);
    expect((await create(b.id, "18:00", "19:00")).status).toBe(201);
  });

  it("reserva cancelada não bloqueia horário", async () => {
    const court = await makeCourt();
    const first = await create(court.id, "18:00", "19:00");
    await api().patch(`/api/bookings/${first.body.data.id}/status`).send({ status: "CANCELLED" });
    expect((await create(court.id, "18:00", "19:00")).status).toBe(201);
  });

  it("início fora da grade de 30 min -> 400", async () => {
    const court = await makeCourt();
    const res = await create(court.id, "18:15", "19:15");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("endsAt");
  });

  it("segundos diferentes de zero -> 400", async () => {
    const court = await makeCourt();
    const res = await create(court.id, "18:00", "19:00", { startsAt: `${day}T18:00:30-03:00` });
    expect(res.status).toBe(400);
  });

  it("início antes das 07:00 -> 400", async () => {
    const court = await makeCourt();
    expect((await create(court.id, "06:30", "07:30")).status).toBe(400);
  });

  it("fim depois das 23:00 -> 400; fim às 23:00 ok; início às 07:00 ok", async () => {
    const court = await makeCourt();
    expect((await create(court.id, "22:30", "23:30")).status).toBe(400);
    expect((await create(court.id, "22:00", "23:00")).status).toBe(201);
    expect((await create(court.id, "07:00", "08:00")).status).toBe(201);
  });

  it("duração inválida (15 min, 4h30, fim <= início) -> 400; 4h ok", async () => {
    const court = await makeCourt();
    expect((await create(court.id, "10:00", "10:15")).status).toBe(400);
    expect((await create(court.id, "10:00", "14:30")).status).toBe(400);
    expect((await create(court.id, "10:00", "10:00")).status).toBe(400);
    expect((await create(court.id, "11:00", "10:00")).status).toBe(400);
    expect((await create(court.id, "10:00", "14:00")).status).toBe(201);
  });

  it("sem offset -> 400", async () => {
    const court = await makeCourt();
    const res = await create(court.id, "10:00", "11:00", { startsAt: `${day}T10:00:00` });
    expect(res.status).toBe(400);
  });

  it("campos obrigatórios ausentes -> 400", async () => {
    const res = await api().post("/api/bookings").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("quadra inativa -> 400 com path courtId", async () => {
    const court = await makeCourt({ active: false });
    const res = await create(court.id, "10:00", "11:00");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("courtId");
  });

  it("quadra inexistente -> 404", async () => {
    const res = await create("nao-existe", "10:00", "11:00");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("criações concorrentes no mesmo horário: só uma passa", async () => {
    const court = await makeCourt();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => create(court.id, "15:00", "16:00")),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
  });
});

describe("GET /api/bookings", () => {
  it("filtra por date (dia local São Paulo) e ordena por startsAt", async () => {
    const court = await makeCourt();
    // 22:00 local = 01:00Z do dia seguinte, mas ainda pertence ao dia local 10
    await create(court.id, "22:00", "23:00");
    await create(court.id, "07:00", "08:00");
    await api()
      .post("/api/bookings")
      .send({
        ...bookingBody(court.id, "10:00", "11:00"),
        startsAt: at("10:00", "2027-03-11"),
        endsAt: at("11:00", "2027-03-11"),
      });
    const res = await api().get(`/api/bookings?date=${day}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((b: { startsAt: string }) => Date.parse(b.startsAt))).toEqual([
      Date.parse(at("07:00")),
      Date.parse(at("22:00")),
    ]);
    expect(res.body.data[0].court).toMatchObject({ id: court.id, name: "Quadra 1" });

    const next = await api().get("/api/bookings?date=2027-03-11");
    expect(next.body.data).toHaveLength(1);
  });

  it("filtra por courtId; sem filtros retorna todas", async () => {
    const a = await makeCourt({ name: "A" });
    const b = await makeCourt({ name: "B" });
    await create(a.id, "10:00", "11:00");
    await create(b.id, "10:00", "11:00");
    expect((await api().get(`/api/bookings?courtId=${a.id}`)).body.data).toHaveLength(1);
    expect((await api().get("/api/bookings")).body.data).toHaveLength(2);
  });

  it("date inválida -> 400", async () => {
    const res = await api().get("/api/bookings?date=02-11-2027");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /api/bookings/:id/status", () => {
  it("altera status", async () => {
    const court = await makeCourt();
    const b = await create(court.id, "10:00", "11:00");
    const res = await api()
      .patch(`/api/bookings/${b.body.data.id}/status`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CONFIRMED");
    expect(res.body.data.price).toBe(80);
  });

  it("status inválido -> 400; id inexistente -> 404", async () => {
    const court = await makeCourt();
    const b = await create(court.id, "10:00", "11:00");
    expect(
      (await api().patch(`/api/bookings/${b.body.data.id}/status`).send({ status: "X" })).status,
    ).toBe(400);
    const res = await api().patch("/api/bookings/nope/status").send({ status: "DONE" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("sair de CANCELLED com conflito -> 409; sem conflito -> 200", async () => {
    const court = await makeCourt();
    const first = await create(court.id, "18:00", "19:00");
    const id = first.body.data.id;
    await api().patch(`/api/bookings/${id}/status`).send({ status: "CANCELLED" });
    const second = await create(court.id, "18:30", "19:30");
    expect(second.status).toBe(201);

    const res = await api().patch(`/api/bookings/${id}/status`).send({ status: "CONFIRMED" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_CONFLICT");

    await api().patch(`/api/bookings/${second.body.data.id}/status`).send({ status: "CANCELLED" });
    const ok = await api().patch(`/api/bookings/${id}/status`).send({ status: "PENDING" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("PENDING");
  });

  it("CANCELLED -> CANCELLED não checa conflito", async () => {
    const court = await makeCourt();
    const b = await create(court.id, "18:00", "19:00");
    const id = b.body.data.id;
    await api().patch(`/api/bookings/${id}/status`).send({ status: "CANCELLED" });
    const res = await api().patch(`/api/bookings/${id}/status`).send({ status: "CANCELLED" });
    expect(res.status).toBe(200);
  });

  it("recusa nome com mais de 80 caracteres", async () => {
    const court = await makeCourt();
    const res = await api()
      .post("/api/bookings")
      .send(bookingBody(court.id, "10:00", "11:00", { customerName: "x".repeat(81) }));
    expect(res.status).toBe(400);
  });
});
