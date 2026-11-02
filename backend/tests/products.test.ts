import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, CAT, makeProduct } from "./helpers.js";

const valid = { name: "Coca", costPrice: 6.5, profitMargin: 0, stockQuantity: 10, categoryId: CAT.BEBIDA };

describe("GET /api/products", () => {
  it("retorna categoria e ordena por nome", async () => {
    await makeProduct({ name: "Pastel", category: "COMIDA" });
    await makeProduct({ name: "Agua", category: "BEBIDA" });
    const res = await api().get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Agua", "Pastel"]);
    expect(res.body.data[0]).toMatchObject({ categoryId: CAT.BEBIDA, categoryName: "Bebida", active: true, price: 5 });
  });

  it("filtra por categoryId", async () => {
    await makeProduct({ name: "Agua", category: "BEBIDA" });
    await makeProduct({ name: "Pastel", category: "COMIDA" });
    await makeProduct({ name: "Bola", category: "OUTRO" });
    const names = async (q: string) =>
      (await api().get(`/api/products${q}`)).body.data.map((p: { name: string }) => p.name);
    expect(await names(`?categoryId=${CAT.BEBIDA}`)).toEqual(["Agua"]);
    expect(await names(`?categoryId=${CAT.COMIDA}`)).toEqual(["Pastel"]);
    expect(await names(`?categoryId=${CAT.OUTRO}`)).toEqual(["Bola"]);
    expect(await names("")).toEqual(["Agua", "Bola", "Pastel"]);
  });

  it("categoryId desconhecido -> lista vazia", async () => {
    await makeProduct();
    const res = await api().get("/api/products?categoryId=nope");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("produto inativo não é listado", async () => {
    const p = await makeProduct({ name: "Off" });
    await api().delete(`/api/products/${p.id}`);
    const res = await api().get("/api/products");
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /api/products?status", () => {
  const names = async (q: string) =>
    (await api().get(`/api/products${q}`)).body.data.map((p: { name: string }) => p.name);

  it("active (default), inactive e all", async () => {
    await makeProduct({ name: "On" });
    const off = await makeProduct({ name: "Off" });
    await api().delete(`/api/products/${off.id}`);
    expect(await names("")).toEqual(["On"]);
    expect(await names("?status=active")).toEqual(["On"]);
    expect(await names("?status=inactive")).toEqual(["Off"]);
    expect(await names("?status=all")).toEqual(["Off", "On"]);
  });

  it("status inválido -> 400", async () => {
    expect((await api().get("/api/products?status=x")).status).toBe(400);
  });
});

describe("POST /api/products", () => {
  it("cria 201 com active true", async () => {
    const res = await api().post("/api/products").send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ...valid, price: 6.5, active: true });
    expect(res.body.data.id).toBeTruthy();
    expect(await prisma.product.count()).toBe(1);
  });

  it("ignora active e id no body (nasce active true)", async () => {
    const res = await api().post("/api/products").send({ ...valid, active: false, id: "x" });
    expect(res.status).toBe(201);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.id).not.toBe("x");
  });

  it("grava name com trim", async () => {
    const res = await api().post("/api/products").send({ ...valid, name: "  Coca  " });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Coca");
    expect((await prisma.product.findFirstOrThrow()).name).toBe("Coca");
  });

  it("aceita name com 80 chars e custo 0.01", async () => {
    const res = await api()
      .post("/api/products")
      .send({ ...valid, name: "a".repeat(80), costPrice: 0.01 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(0.01);
  });

  it.each([
    ["name > 80", { name: "a".repeat(81) }, "name"],
    ["name vazio", { name: "" }, "name"],
    ["name só espaços", { name: "   " }, "name"],
    ["sem name", { name: undefined }, "name"],
    ["costPrice 0", { costPrice: 0 }, "costPrice"],
    ["costPrice negativo", { costPrice: -1 }, "costPrice"],
    ["costPrice 3 casas", { costPrice: 1.234 }, "costPrice"],
    ["costPrice string", { costPrice: "5" }, "costPrice"],
    ["sem costPrice", { costPrice: undefined }, "costPrice"],
    ["margem negativa", { profitMargin: -1 }, "profitMargin"],
    ["margem > 1000", { profitMargin: 1000.01 }, "profitMargin"],
    ["estoque negativo", { stockQuantity: -1 }, "stockQuantity"],
    ["estoque fracionado", { stockQuantity: 1.5 }, "stockQuantity"],
    ["sem estoque", { stockQuantity: undefined }, "stockQuantity"],
    ["categoryId inexistente", { categoryId: "nope" }, "categoryId"],
    ["sem categoryId", { categoryId: undefined }, "categoryId"],
  ])("validação: %s -> 400", async (_n, patch, path) => {
    const res = await api()
      .post("/api/products")
      .send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await prisma.product.count()).toBe(0);
  });

  it("duplicado case-insensitive -> 409 PRODUCT_NAME_TAKEN", async () => {
    await api().post("/api/products").send(valid);
    for (const name of ["Coca", "coca", "COCA", "  cOcA "]) {
      const res = await api().post("/api/products").send({ ...valid, name });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PRODUCT_NAME_TAKEN");
    }
    expect(await prisma.product.count()).toBe(1);
  });

  it("nome de produto excluído pode ser reutilizado", async () => {
    await makeProduct({ name: "Coca", active: false });
    const res = await api().post("/api/products").send(valid);
    expect(res.status).toBe(201);
  });

  it("mesmo nome em outra categoria continua duplicado", async () => {
    await api().post("/api/products").send(valid);
    const res = await api().post("/api/products").send({ ...valid, categoryId: CAT.COMIDA });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/products/:id", () => {
  it("atualiza parcialmente, mantendo demais campos", async () => {
    const p = await makeProduct({ name: "Agua", price: "5.00", category: "BEBIDA" });
    const res = await api().patch(`/api/products/${p.id}`).send({ costPrice: 7.25 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: p.id,
      name: "Agua",
      price: 7.25,
      costPrice: 7.25,
      profitMargin: 0,
      stockQuantity: 1000,
      categoryId: CAT.BEBIDA,
      categoryName: "Bebida",
      active: true,
    });
  });

  it("atualiza todos os campos de uma vez com trim", async () => {
    const p = await makeProduct();
    const res = await api()
      .patch(`/api/products/${p.id}`)
      .send({ name: "  Pastel ", costPrice: 9, categoryId: CAT.COMIDA });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "Pastel",
      price: 9,
      categoryId: CAT.COMIDA,
      categoryName: "Comida",
    });
  });

  it("PATCH em item excluído -> 404 NOT_FOUND e não altera", async () => {
    const p = await makeProduct();
    await api().delete(`/api/products/${p.id}`);
    for (const body of [{ name: "Novo" }, { costPrice: 9 }, { stockQuantity: 3 }]) {
      const res = await api().patch(`/api/products/${p.id}`).send(body);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ name: "Agua", active: false });
  });

  it("active no body do PATCH é ignorado (não reativa)", async () => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({ active: false, costPrice: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
  });

  it("body vazio -> 400", async () => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("id inexistente -> 404", async () => {
    const res = await api().patch("/api/products/nope").send({ costPrice: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["costPrice 0", { costPrice: 0 }],
    ["costPrice negativo", { costPrice: -2 }],
    ["costPrice 3 casas", { costPrice: 1.005 }],
    ["name > 80", { name: "a".repeat(81) }],
    ["name vazio", { name: "  " }],
    ["categoryId vazio", { categoryId: "" }],
  ])("validação: %s -> 400 e não altera", async (_n, body) => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ name: "Agua", categoryId: CAT.BEBIDA, active: true });
    expect(row.price.toNumber()).toBe(5);
  });

  it("renomear para nome de outro (case-insensitive) -> 409", async () => {
    await makeProduct({ name: "Coca" });
    const b = await makeProduct({ name: "Guarana" });
    for (const name of ["Coca", "coca", " COCA "]) {
      const res = await api().patch(`/api/products/${b.id}`).send({ name });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PRODUCT_NAME_TAKEN");
    }
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).name).toBe("Guarana");
  });

  it("renomear para nome de produto inativo -> 200", async () => {
    await makeProduct({ name: "Coca", active: false });
    const b = await makeProduct({ name: "Guarana" });
    const res = await api().patch(`/api/products/${b.id}`).send({ name: "coca" });
    expect(res.status).toBe(200);
  });

  it("PATCH com categoryId inexistente -> 400 categoryId", async () => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({ categoryId: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe("categoryId");
  });

  it("mudar só a caixa do próprio nome -> 200", async () => {
    const p = await makeProduct({ name: "coca" });
    const res = await api().patch(`/api/products/${p.id}`).send({ name: "COCA" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("COCA");
  });

  it("reenviar o mesmo nome -> 200", async () => {
    const p = await makeProduct({ name: "Coca" });
    const res = await api().patch(`/api/products/${p.id}`).send({ name: "Coca", costPrice: 8 });
    expect(res.status).toBe(200);
  });
});

describe("produto inativo e pedidos", () => {
  it("POST /orders com produto excluído -> 400 items[0].productId", async () => {
    const p = await makeProduct();
    await api().delete(`/api/products/${p.id}`);
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("items[0].productId");
    expect(await prisma.order.count()).toBe(0);
  });

  it("pedido antigo mantém itens após desativar produto", async () => {
    const p = await makeProduct();
    const o = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 2 }] });
    await api().delete(`/api/products/${p.id}`);
    const list = await api().get("/api/orders");
    expect(list.body.data[0].id).toBe(o.body.data.id);
    expect(list.body.data[0].total).toBe(10);
    expect(list.body.data[0].items[0].productName).toBe("Agua");
  });
});

describe("DELETE /api/products/:id", () => {
  it("soft delete: 204, some da lista e mantém a linha e os pedidos", async () => {
    const p = await makeProduct();
    const o = await api().post("/api/orders").send({ items: [{ productId: p.id, quantity: 2 }] });
    expect(o.status).toBe(201);
    const res = await api().delete(`/api/products/${p.id}`);
    expect(res.status).toBe(204);
    expect((await api().get("/api/products")).body.data).toEqual([]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).active).toBe(false);
    expect((await api().get("/api/orders")).body.data[0].total).toBe(10);
  });

  it("inexistente ou já excluído -> 404 NOT_FOUND", async () => {
    const p = await makeProduct();
    expect((await api().delete(`/api/products/${p.id}`)).status).toBe(204);
    for (const id of [p.id, "nope"]) {
      const res = await api().delete(`/api/products/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("nome de produto: caracteres invisíveis e NFKC", () => {
  it.each([
    ["U+3164", "Co\u3164ca"],
    ["U+2800", "\u2800Coca"],
    ["U+2028", "Co\u2028ca"],
    ["3 marcas combinantes", "a\u0301\u0302\u0303\u0304"],
  ])("%s -> 400", async (_n, name) => {
    const res = await api().post("/api/products").send({ ...valid, name });
    expect(res.status).toBe(400);
  });

  it("NFKC: fullwidth vira ASCII e colide com nome existente", async () => {
    await makeProduct({ name: "Coca" });
    const res = await api().post("/api/products").send({ ...valid, name: "\uFF23oca" });
    expect(res.status).toBe(409);
  });
});
