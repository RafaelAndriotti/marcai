import { describe, expect, it } from "vitest";
import { api } from "./helpers.js";

describe("app", () => {
  it("GET /api/health", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok" } });
  });

  it("404 em rota inexistente", async () => {
    const res = await api().get("/api/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("JSON malformado -> 400 VALIDATION_ERROR", async () => {
    const res = await api()
      .post("/api/courts")
      .set("Content-Type", "application/json")
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
