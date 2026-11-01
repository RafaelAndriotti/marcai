import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, makeProduct } from "./helpers.js";

const valid = { name: "Coca", price: 6.5, category: "BEBIDA" };

describe("GET /api/products", () => {
  it("retorna category e ordena por nome", async () => {
    await makeProduct({ name: "Pastel", category: "COMIDA" });
    await makeProduct({ name: "Agua", category: "BEBIDA" });
    const res = await api().get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Agua", "Pastel"]);
    expect(res.body.data[0]).toMatchObject({ category: "BEBIDA", active: true, price: 5 });
  });

  it("default de category no banco é OUTRO", async () => {
    const p = await prisma.product.create({ data: { name: "Sem cat", price: "1.00" } });
    expect(p.category).toBe("OUTRO");
  });

  it("filtra por category", async () => {
    await makeProduct({ name: "Agua", category: "BEBIDA" });
    await makeProduct({ name: "Pastel", category: "COMIDA" });
    await makeProduct({ name: "Bola", category: "OUTRO" });
    const names = async (q: string) =>
      (await api().get(`/api/products${q}`)).body.data.map((p: { name: string }) => p.name);
    expect(await names("?category=BEBIDA")).toEqual(["Agua"]);
    expect(await names("?category=COMIDA")).toEqual(["Pastel"]);
    expect(await names("?category=OUTRO")).toEqual(["Bola"]);
    expect(await names("")).toEqual(["Agua", "Bola", "Pastel"]);
  });

  it("category inválida -> 400", async () => {
    for (const q of ["FOO", "bebida", ""]) {
      const res = await api().get(`/api/products?category=${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("produto inativo continua listado", async () => {
    const p = await makeProduct({ name: "Off" });
    await api().patch(`/api/products/${p.id}`).send({ active: false });
    const res = await api().get("/api/products");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: p.id, active: false });
  });
});

describe("POST /api/products", () => {
  it("cria 201 com active true", async () => {
    const res = await api().post("/api/products").send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ...valid, active: true });
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

  it("aceita name com 80 chars e preço 0.01", async () => {
    const res = await api()
      .post("/api/products")
      .send({ ...valid, name: "a".repeat(80), price: 0.01 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(0.01);
  });

  it.each([
    ["name > 80", { name: "a".repeat(81) }, "name"],
    ["name vazio", { name: "" }, "name"],
    ["name só espaços", { name: "   " }, "name"],
    ["sem name", { name: undefined }, "name"],
    ["price 0", { price: 0 }, "price"],
    ["price negativo", { price: -1 }, "price"],
    ["price 3 casas", { price: 1.234 }, "price"],
    ["price string", { price: "5" }, "price"],
    ["sem price", { price: undefined }, "price"],
    ["category inválida", { category: "FOO" }, "category"],
    ["category minúscula", { category: "bebida" }, "category"],
    ["sem category", { category: undefined }, "category"],
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

  it("duplicado de produto inativo também -> 409", async () => {
    await makeProduct({ name: "Coca", active: false });
    const res = await api().post("/api/products").send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PRODUCT_NAME_TAKEN");
  });

  it("mesmo nome em outra categoria continua duplicado", async () => {
    await api().post("/api/products").send(valid);
    const res = await api().post("/api/products").send({ ...valid, category: "COMIDA" });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/products/:id", () => {
  it("atualiza parcialmente, mantendo demais campos", async () => {
    const p = await makeProduct({ name: "Agua", price: "5.00", category: "BEBIDA" });
    const res = await api().patch(`/api/products/${p.id}`).send({ price: 7.25 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: p.id,
      name: "Agua",
      price: 7.25,
      category: "BEBIDA",
      active: true,
    });
  });

  it("atualiza todos os campos de uma vez com trim", async () => {
    const p = await makeProduct();
    const res = await api()
      .patch(`/api/products/${p.id}`)
      .send({ name: "  Pastel ", price: 9, category: "COMIDA", active: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "Pastel",
      price: 9,
      category: "COMIDA",
      active: false,
    });
  });

  it("reativa produto (active true)", async () => {
    const p = await makeProduct({ active: false });
    const res = await api().patch(`/api/products/${p.id}`).send({ active: true });
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
    const res = await api().patch("/api/products/nope").send({ price: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["price 0", { price: 0 }],
    ["price negativo", { price: -2 }],
    ["price 3 casas", { price: 1.005 }],
    ["name > 80", { name: "a".repeat(81) }],
    ["name vazio", { name: "  " }],
    ["category inválida", { category: "FOO" }],
    ["active não booleano", { active: "false" }],
  ])("validação: %s -> 400 e não altera", async (_n, body) => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ name: "Agua", category: "BEBIDA", active: true });
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

  it("renomear para nome de produto inativo -> 409", async () => {
    await makeProduct({ name: "Coca", active: false });
    const b = await makeProduct({ name: "Guarana" });
    const res = await api().patch(`/api/products/${b.id}`).send({ name: "coca" });
    expect(res.status).toBe(409);
  });

  it("mudar só a caixa do próprio nome -> 200", async () => {
    const p = await makeProduct({ name: "coca" });
    const res = await api().patch(`/api/products/${p.id}`).send({ name: "COCA" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("COCA");
  });

  it("reenviar o mesmo nome -> 200", async () => {
    const p = await makeProduct({ name: "Coca" });
    const res = await api().patch(`/api/products/${p.id}`).send({ name: "Coca", price: 8 });
    expect(res.status).toBe(200);
  });
});

describe("produto inativo e pedidos", () => {
  it("POST /orders com produto desativado via PATCH -> 400 items[0].productId", async () => {
    const p = await makeProduct();
    await api().patch(`/api/products/${p.id}`).send({ active: false });
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("items[0].productId");
    expect(await prisma.order.count()).toBe(0);
  });

  it("reativar volta a permitir pedido", async () => {
    const p = await makeProduct({ active: false });
    await api().patch(`/api/products/${p.id}`).send({ active: true });
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(201);
  });

  it("pedido antigo mantém itens após desativar produto", async () => {
    const p = await makeProduct();
    const o = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 2 }] });
    await api().patch(`/api/products/${p.id}`).send({ active: false });
    const list = await api().get("/api/orders");
    expect(list.body.data[0].id).toBe(o.body.data.id);
    expect(list.body.data[0].total).toBe(10);
  });
});
