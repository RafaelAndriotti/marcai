import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, bookingBody, makeCourt, makeProduct } from "./helpers.js";

describe("orders", () => {
  it("cria com total correto, unitPrice copiado e status OPEN", async () => {
    const agua = await makeProduct({ name: "Agua", price: "5.00" });
    const iso = await makeProduct({ name: "Isotonico", price: "7.50" });
    const res = await api()
      .post("/api/orders")
      .send({
        customerName: "Beto",
        total: 1,
        items: [
          { productId: agua.id, quantity: 2, unitPrice: 1 },
          { productId: iso.id, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: "OPEN",
      total: 17.5,
      customerName: "Beto",
      bookingId: null,
    });
    const items = res.body.data.items;
    expect(items).toHaveLength(2);
    expect(items.find((i: { productName: string }) => i.productName === "Agua")).toMatchObject({
      productId: agua.id,
      quantity: 2,
      unitPrice: 5,
      subtotal: 10,
    });
  });

  it("mudança de preço do produto não altera pedido antigo", async () => {
    const p = await makeProduct({ price: "5.00" });
    const created = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 1 }] });
    await prisma.product.update({ where: { id: p.id }, data: { price: "9.00" } });
    const list = await api().get("/api/orders");
    expect(list.body.data[0].id).toBe(created.body.data.id);
    expect(list.body.data[0].total).toBe(5);
    expect(list.body.data[0].items[0].unitPrice).toBe(5);
  });

  it("com bookingId usa cliente da reserva", async () => {
    const court = await makeCourt();
    const p = await makeProduct();
    const b = await api().post("/api/bookings").send(bookingBody(court.id, "10:00", "11:00"));
    const res = await api()
      .post("/api/orders")
      .send({ bookingId: b.body.data.id, items: [{ productId: p.id, quantity: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      bookingId: b.body.data.id,
      customerName: "Ana",
      total: 15,
    });
  });

  it("bookingId inexistente -> 404", async () => {
    const p = await makeProduct();
    const res = await api()
      .post("/api/orders")
      .send({ bookingId: "nope", items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("produto inativo -> 400 com path items[n].productId", async () => {
    const ok = await makeProduct({ name: "Ok" });
    const off = await makeProduct({ name: "Off", active: false });
    const res = await api()
      .post("/api/orders")
      .send({
        items: [
          { productId: ok.id, quantity: 1 },
          { productId: off.id, quantity: 1 },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("items[1].productId");
  });

  it("produto inexistente -> 404", async () => {
    const res = await api()
      .post("/api/orders")
      .send({ items: [{ productId: "nope", quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["items vazio", { items: [] }],
    ["quantity 0", { items: [{ productId: "x", quantity: 0 }] }],
    ["quantity 1000", { items: [{ productId: "x", quantity: 1000 }] }],
    ["quantity fracionária", { items: [{ productId: "x", quantity: 1.5 }] }],
    ["sem items", {}],
  ])("validação: %s -> 400", async (_n, body) => {
    const res = await api().post("/api/orders").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("filtra por status e ordena por createdAt desc", async () => {
    const p = await makeProduct();
    const o1 = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 1 }] });
    const o2 = await api()
      .post("/api/orders")
      .send({ items: [{ productId: p.id, quantity: 2 }] });
    await prisma.order.update({ where: { id: o1.body.data.id }, data: { status: "PAID" } });

    const ids = (r: { body: { data: { id: string }[] } }) => r.body.data.map((o) => o.id);
    expect(ids(await api().get("/api/orders?status=OPEN"))).toEqual([o2.body.data.id]);
    expect(ids(await api().get("/api/orders?status=PAID"))).toEqual([o1.body.data.id]);
    expect(ids(await api().get("/api/orders?status=CANCELLED"))).toEqual([]);
    expect(ids(await api().get("/api/orders"))).toEqual([o2.body.data.id, o1.body.data.id]);
  });

  it("status inválido -> 400", async () => {
    expect((await api().get("/api/orders?status=FOO")).status).toBe(400);
  });
});

describe("products", () => {
  it("lista ordenado por nome incluindo inativos", async () => {
    await makeProduct({ name: "B", price: "7.50" });
    await makeProduct({ name: "A", active: false });
    const res = await api().get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["A", "B"]);
    expect(res.body.data[1].price).toBe(7.5);
  });
});
