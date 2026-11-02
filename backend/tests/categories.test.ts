import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api } from "./helpers.js";

describe("categories", () => {
  it("GET lista ordenada por nome", async () => {
    const res = await api().get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(["Bebida", "Comida", "Outro"]);
  });

  it("POST cria (201) com trim e aparece na lista", async () => {
    const res = await api().post("/api/categories").send({ name: "  Suplemento " });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Suplemento" });
    const list = await api().get("/api/categories");
    expect(list.body.data.map((c: { name: string }) => c.name)).toContain("Suplemento");
  });

  it("nome duplicado (case-insensitive) -> 409 CATEGORY_NAME_TAKEN", async () => {
    const res = await api().post("/api/categories").send({ name: "bebida" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATEGORY_NAME_TAKEN");
  });

  it.each([
    ["vazio", "  "],
    ["> 40", "a".repeat(41)],
    ["controle", "ab\u0000c"],
    ["hangul filler U+3164", "ab\u3164"],
    ["braille em branco U+2800", "\u2800ab"],
    ["U+115F", "a\u115Fb"],
    ["U+1160", "a\u1160b"],
    ["U+FFA0", "a\uFFA0b"],
    ["separador de linha U+2028", "a\u2028b"],
    ["separador de parágrafo U+2029", "a\u2029b"],
    ["zero width U+200B", "a\u200Bb"],
    ["3 marcas combinantes", "a\u0301\u0302\u0303\u0304"],
  ])("nome %s -> 400", async (_n, name) => {
    const res = await api().post("/api/categories").send({ name });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("NFKC: forma de compatibilidade colide com a forma normal", async () => {
    // "ＢＥＢＩＤＡ" (fullwidth) vira "BEBIDA" e bate com "Bebida" existente
    const res = await api().post("/api/categories").send({ name: "\uFF22\uFF25\uFF22\uFF29\uFF24\uFF21" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATEGORY_NAME_TAKEN");
  });

  it("corrida: 2 POSTs com o mesmo nome -> um 201 e um 409", async () => {
    const [a, b] = await Promise.all([
      api().post("/api/categories").send({ name: "Corrida" }),
      api().post("/api/categories").send({ name: "corrida" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.category.count({ where: { name: { in: ["Corrida", "corrida"] } } })).toBe(1);
  });

  it("limite de 50: 51a -> 409 CATEGORY_LIMIT_REACHED, mesmo em paralelo", async () => {
    // setup já cria 3
    await prisma.category.createMany({ data: Array.from({ length: 46 }, (_, i) => ({ name: `Cat ${i}` })) });
    const rs = await Promise.all(
      ["X1", "X2", "X3", "X4"].map((name) => api().post("/api/categories").send({ name })),
    );
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    const limited = rs.filter((r) => r.status === 409);
    expect(limited).toHaveLength(3);
    for (const r of limited) expect(r.body.error.code).toBe("CATEGORY_LIMIT_REACHED");
    expect(await prisma.category.count()).toBe(50);
  });
});
