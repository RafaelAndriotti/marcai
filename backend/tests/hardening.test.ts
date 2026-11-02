import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { productModel } from "../src/models/product.model.js";
import { api, makeProduct } from "./helpers.js";

const paths = (res: { body: { error: { details: { path: string }[] } } }) =>
  res.body.error.details.map((d) => d.path);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("limites de preço", () => {
  const base = { name: "Coca", categoryId: "cat_bebida", profitMargin: 0, stockQuantity: 0 };

  it("POST: 100000 -> 201", async () => {
    const res = await api()
      .post("/api/products")
      .send({ ...base, costPrice: 100000 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(100000);
  });

  it.each([[100000.01, "price"], [0.001, "costPrice"], [0.010000001, "costPrice"]])("POST: %s -> 400 path %s", async (costPrice, path) => {
    const res = await api().post("/api/products").send({ ...base, costPrice });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(paths(res)).toContain(path);
  });

  it("PATCH: 100000 -> 200", async () => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({ costPrice: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(100000);
  });

  it.each([[100000.01, "price"], [0.001, "costPrice"], [0.010000001, "costPrice"]])("PATCH: %s -> 400 path %s", async (costPrice, path) => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({ costPrice });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(paths(res)).toContain(path);
  });

  it("court pricePerHour 1e12 -> 400 (não 500)", async () => {
    const res = await api()
      .post("/api/courts")
      .send({ name: "X", sport: "VOLEI", pricePerHour: 1e12 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(paths(res)).toContain("pricePerHour");
  });
});

describe("nome de produto: caracteres", () => {
  const body = { costPrice: 5, profitMargin: 0, stockQuantity: 0, categoryId: "cat_bebida" };

  it.each([
    ["controle \\u0000", "Co\u0000ca"],
    ["controle \\n", "Co\nca"],
    ["zero-width \\u200b", "Co​ca"],
  ])("POST com %s -> 400 path name", async (_n, name) => {
    const res = await api().post("/api/products").send({ ...body, name });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(paths(res)).toContain("name");
    expect(await prisma.product.count()).toBe(0);
  });

  it("PATCH com caractere de controle -> 400", async () => {
    const p = await makeProduct();
    const res = await api().patch(`/api/products/${p.id}`).send({ name: "A\u0000B" });
    expect(res.status).toBe(400);
  });

  it("NFC: decomposto e precomposto são o mesmo nome -> 409", async () => {
    const decomposed = "Café";
    const precomposed = "Café";
    const first = await api()
      .post("/api/products")
      .send({ ...body, name: decomposed });
    expect(first.status).toBe(201);
    const second = await api()
      .post("/api/products")
      .send({ ...body, name: precomposed });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("PRODUCT_NAME_TAKEN");
  });
});

describe("orders: limites e mensagens", () => {
  it("customerName 81 chars -> 400", async () => {
    const p = await makeProduct();
    const res = await api()
      .post("/api/orders")
      .send({ customerName: "a".repeat(81), items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(paths(res)).toContain("customerName");
  });

  it("customerName 80 chars -> 201", async () => {
    const p = await makeProduct();
    const res = await api()
      .post("/api/orders")
      .send({ customerName: "a".repeat(80), items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(201);
  });

  it("bookingId 65 chars -> 400", async () => {
    const p = await makeProduct();
    const res = await api()
      .post("/api/orders")
      .send({ bookingId: "b".repeat(65), items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(paths(res)).toContain("bookingId");
  });

  it("productId 65 chars -> 400", async () => {
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: "p".repeat(65), quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(paths(res)).toContain("items[0].productId");
  });

  it("overflow de total (50 x 100000 x 999) -> 400 VALIDATION_ERROR path total", async () => {
    const products = [];
    for (let i = 0; i < 50; i++) products.push(await makeProduct({ name: `P${i}`, price: "100000.00" }));
    const res = await api()
      .post("/api/orders")
      .send({ items: products.map((p) => ({ productId: p.id, quantity: 999 })) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(paths(res)).toContain("total");
    expect(await prisma.order.count()).toBe(0);
  });

  it("produto inexistente -> 404 com details.productId e mensagem", async () => {
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: "nope", quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Produto não encontrado");
    expect(res.body.error.details).toMatchObject({ productId: "nope" });
  });

  it("reserva inexistente -> 404 com mensagem", async () => {
    const p = await makeProduct();
    const res = await api()
      .post("/api/orders")
      .send({ bookingId: "nope", items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Reserva não encontrada");
  });
});

describe("app: headers, body e rotas", () => {
  it("headers de segurança e no-store em /api", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("headers também em erro 404 e 400", async () => {
    const res = await api().get("/api/nao-existe");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("JSON > 16kb -> 400 VALIDATION_ERROR", async () => {
    const res = await api()
      .post("/api/products")
      .send({ name: "a".repeat(20 * 1024), costPrice: 1, profitMargin: 0, stockQuantity: 0, categoryId: "cat_bebida" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rota inexistente -> 404 sem ecoar o path", async () => {
    const res = await api().get("/api/segredo-xyz123");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Rota não encontrada");
    expect(JSON.stringify(res.body)).not.toContain("segredo-xyz123");
  });
});

describe("erro 500", () => {
  it("erro inesperado -> 500 INTERNAL_ERROR com requestId e sem stack", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(productModel, "list").mockRejectedValue(new Error("boom secreto com stack"));
    const res = await api().get("/api/products");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.details.requestId).toMatch(/^[0-9a-f]+$/);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("boom secreto");
    expect(raw).not.toMatch(/stack|\bat .*\(.*:\d+:\d+\)/);
  });
});

