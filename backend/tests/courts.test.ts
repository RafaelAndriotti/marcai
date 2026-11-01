import { describe, expect, it } from "vitest";
import { api, makeCourt } from "./helpers.js";

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
