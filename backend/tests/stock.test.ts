import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { api, makeProduct } from "./helpers.js";

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity;
const order = (items: { productId: string; quantity: number }[]) =>
  api().post("/api/orders").send({ items });
const setStatus = (id: string, status: string) =>
  api().patch(`/api/orders/${id}/status`).send({ status });

describe("preço calculado", () => {
  const base = { name: "Coca", costPrice: 10, profitMargin: 0, stockQuantity: 1, categoryId: "cat_bebida" };

  it.each([
    ["10 +50%", 10, 50, 15],
    ["6.5 +0%", 6.5, 0, 6.5],
    ["HALF_UP 0.01 +50% = 0.015 -> 0.02", 0.01, 50, 0.02],
    ["HALF_UP 1.01 +50% = 1.515 -> 1.52", 1.01, 50, 1.52],
    ["HALF_UP 10 +12.345%... margem 2 casas: 10 +12.34% = 11.234 -> 11.23", 10, 12.34, 11.23],
    ["custo 0.01 +0% = 0.01 (mínimo)", 0.01, 0, 0.01],
  ])("POST %s", async (_n, costPrice, profitMargin, price) => {
    const res = await api().post("/api/products").send({ ...base, costPrice, profitMargin });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(price);
    expect((await prisma.product.findFirstOrThrow()).price.toNumber()).toBe(price);
  });

  it("POST ignora price enviado", async () => {
    const res = await api().post("/api/products").send({ ...base, price: 999 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(10);
  });

  it("PATCH ignora price enviado (junto de outro campo)", async () => {
    const p = await makeProduct({ price: "5.00" });
    const res = await api().patch(`/api/products/${p.id}`).send({ price: 999, stockQuantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ price: 5, stockQuantity: 3 });
  });

  it("POST preço > MAX_PRODUCT_PRICE -> 400 path price, nada criado", async () => {
    const res = await api().post("/api/products").send({ ...base, costPrice: 100_000, profitMargin: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain("price");
    expect(await prisma.product.count()).toBe(0);
  });

  it("POST preço exatamente MAX_PRODUCT_PRICE -> 201", async () => {
    const res = await api().post("/api/products").send({ ...base, costPrice: 100_000 });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBe(100_000);
  });

  describe("PATCH parcial recalcula com valores do banco", () => {
    const seed = () =>
      prisma.product.create({
        data: { name: "X", price: "15.00", costPrice: "10.00", profitMargin: 50, stockQuantity: 5, categoryId: "cat_bebida" },
      });

    it("só profitMargin usa costPrice atual", async () => {
      const p = await seed();
      const res = await api().patch(`/api/products/${p.id}`).send({ profitMargin: 100 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ price: 20, costPrice: 10, profitMargin: 100 });
    });

    it("só costPrice usa profitMargin atual", async () => {
      const p = await seed();
      const res = await api().patch(`/api/products/${p.id}`).send({ costPrice: 20 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ price: 30, costPrice: 20, profitMargin: 50 });
    });

    it("ambos enviados", async () => {
      const p = await seed();
      const res = await api().patch(`/api/products/${p.id}`).send({ costPrice: 4, profitMargin: 25 });
      expect(res.body.data).toMatchObject({ price: 5, costPrice: 4, profitMargin: 25 });
    });

    it("só name/stock não recalcula preço", async () => {
      const p = await prisma.product.create({
        data: { name: "Y", price: "99.00", costPrice: "10.00", profitMargin: 50, stockQuantity: 5, categoryId: "cat_bebida" },
      });
      const res = await api().patch(`/api/products/${p.id}`).send({ stockQuantity: 7 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ price: 99, stockQuantity: 7 });
    });

    it("preço resultante > MAX -> 400 path price e não altera", async () => {
      const p = await prisma.product.create({
        data: { name: "Z", price: "90000.00", costPrice: "90000.00", profitMargin: 0, stockQuantity: 1, categoryId: "cat_bebida" },
      });
      const res = await api().patch(`/api/products/${p.id}`).send({ profitMargin: 20 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain("price");
      const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
      expect(row.profitMargin.toNumber()).toBe(0);
      expect(row.price.toNumber()).toBe(90000);
    });

    it("id inexistente com costPrice -> 404", async () => {
      const res = await api().patch("/api/products/nope").send({ profitMargin: 10 });
      expect(res.status).toBe(404);
    });
  });
});

describe("baixa de estoque no pedido", () => {
  it("baixa a quantidade de cada produto", async () => {
    const a = await makeProduct({ name: "A", stockQuantity: 10 });
    const b = await makeProduct({ name: "B", stockQuantity: 4 });
    const res = await order([
      { productId: a.id, quantity: 3 },
      { productId: b.id, quantity: 4 },
    ]);
    expect(res.status).toBe(201);
    expect(await stockOf(a.id)).toBe(7);
    expect(await stockOf(b.id)).toBe(0);
  });

  it("pode zerar o estoque exatamente", async () => {
    const p = await makeProduct({ stockQuantity: 2 });
    expect((await order([{ productId: p.id, quantity: 2 }])).status).toBe(201);
    expect(await stockOf(p.id)).toBe(0);
  });

  it("mesmo produto em vários itens soma quantidades (via service)", async () => {
    // a API recusa productId repetido com 400 (orders.test); o service soma mesmo assim.
    const p = await makeProduct({ stockQuantity: 5 });
    const res = await order([
      { productId: p.id, quantity: 2 },
      { productId: p.id, quantity: 4 },
    ]);
    // 2+4=6 > 5: se a API aceitasse, seria 409; hoje a validação barra antes
    expect([400, 409]).toContain(res.status);
    expect(await stockOf(p.id)).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });

  it("saldo insuficiente -> 409 INSUFFICIENT_STOCK com details", async () => {
    const p = await makeProduct({ stockQuantity: 2 });
    const res = await order([{ productId: p.id, quantity: 3 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.error.details).toEqual({ productId: p.id, available: 2 });
    expect(await stockOf(p.id)).toBe(2);
    expect(await prisma.order.count()).toBe(0);
  });

  it("estoque 0 -> 409 com available 0", async () => {
    const p = await makeProduct({ stockQuantity: 0 });
    const res = await order([{ productId: p.id, quantity: 1 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ productId: p.id, available: 0 });
  });

  it("multi-item: um sem saldo reverte tudo (nenhum baixado, nenhum Order)", async () => {
    const ok = await makeProduct({ name: "Ok", stockQuantity: 10 });
    const low = await makeProduct({ name: "Low", stockQuantity: 1 });
    const res = await order([
      { productId: ok.id, quantity: 5 },
      { productId: low.id, quantity: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ productId: low.id, available: 1 });
    expect(await stockOf(ok.id)).toBe(10);
    expect(await stockOf(low.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
  });

  it("sem saldo no primeiro item e ok no segundo também não baixa", async () => {
    const low = await makeProduct({ name: "Low", stockQuantity: 0 });
    const ok = await makeProduct({ name: "Ok", stockQuantity: 10 });
    const res = await order([
      { productId: low.id, quantity: 1 },
      { productId: ok.id, quantity: 5 },
    ]);
    expect(res.status).toBe(409);
    expect(await stockOf(ok.id)).toBe(10);
  });

  it("PATCH stockQuantity reabastece e permite pedido", async () => {
    const p = await makeProduct({ stockQuantity: 0 });
    expect((await order([{ productId: p.id, quantity: 1 }])).status).toBe(409);
    await api().patch(`/api/products/${p.id}`).send({ stockQuantity: 1 });
    expect((await order([{ productId: p.id, quantity: 1 }])).status).toBe(201);
    expect(await stockOf(p.id)).toBe(0);
  });
});

describe("devolução de estoque ao mudar status", () => {
  async function open(stock = 10, qty = 4) {
    const p = await makeProduct({ stockQuantity: stock });
    const res = await order([{ productId: p.id, quantity: qty }]);
    return { p, id: res.body.data.id as string };
  }

  it("OPEN -> CANCELLED devolve", async () => {
    const { p, id } = await open();
    expect(await stockOf(p.id)).toBe(6);
    const res = await setStatus(id, "CANCELLED");
    expect(res.status).toBe(200);
    expect(await stockOf(p.id)).toBe(10);
  });

  it("cancelar pedido multi-item devolve todos", async () => {
    const a = await makeProduct({ name: "A", stockQuantity: 10 });
    const b = await makeProduct({ name: "B", stockQuantity: 10 });
    const o = await order([
      { productId: a.id, quantity: 3 },
      { productId: b.id, quantity: 7 },
    ]);
    await setStatus(o.body.data.id, "CANCELLED");
    expect(await stockOf(a.id)).toBe(10);
    expect(await stockOf(b.id)).toBe(10);
  });

  it("OPEN -> PAID não altera estoque", async () => {
    const { p, id } = await open();
    const res = await setStatus(id, "PAID");
    expect(res.status).toBe(200);
    expect(await stockOf(p.id)).toBe(6);
  });

  it("cancelar duas vezes: 2ª -> 409 ORDER_NOT_OPEN e não devolve de novo", async () => {
    const { p, id } = await open();
    await setStatus(id, "CANCELLED");
    const res = await setStatus(id, "CANCELLED");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_NOT_OPEN");
    expect(await stockOf(p.id)).toBe(10);
  });

  it("PAID -> CANCELLED: 409 e não devolve", async () => {
    const { p, id } = await open();
    await setStatus(id, "PAID");
    const res = await setStatus(id, "CANCELLED");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_NOT_OPEN");
    expect(await stockOf(p.id)).toBe(6);
  });

  it("CANCELLED -> PAID: 409 e estoque segue devolvido", async () => {
    const { p, id } = await open();
    await setStatus(id, "CANCELLED");
    expect((await setStatus(id, "PAID")).status).toBe(409);
    expect(await stockOf(p.id)).toBe(10);
  });

  it("cancelamentos simultâneos do mesmo pedido devolvem uma vez só", async () => {
    const { p, id } = await open();
    const rs = await Promise.all([setStatus(id, "CANCELLED"), setStatus(id, "CANCELLED"), setStatus(id, "CANCELLED")]);
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await stockOf(p.id)).toBe(10);
  });

  it("estoque devolvido permite novo pedido", async () => {
    const { p, id } = await open(4, 4);
    expect((await order([{ productId: p.id, quantity: 1 }])).status).toBe(409);
    await setStatus(id, "CANCELLED");
    expect((await order([{ productId: p.id, quantity: 4 }])).status).toBe(201);
  });
});

describe("concorrência", () => {
  it("dois pedidos disputando o último saldo: exatamente um sucede", async () => {
    const p = await makeProduct({ stockQuantity: 1 });
    const rs = await Promise.all([order([{ productId: p.id, quantity: 1 }]), order([{ productId: p.id, quantity: 1 }])]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(rs.find((r) => r.status === 409)!.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(p.id)).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it("N pedidos concorrentes: sucessos = saldo, estoque nunca negativo", async () => {
    const p = await makeProduct({ stockQuantity: 3 });
    const rs = await Promise.all(Array.from({ length: 8 }, () => order([{ productId: p.id, quantity: 1 }])));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(3);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await stockOf(p.id)).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });

  it("pedidos multi-produto em ordem inversa não dão deadlock", async () => {
    const a = await makeProduct({ name: "A", stockQuantity: 9 });
    const b = await makeProduct({ name: "B", stockQuantity: 9 });
    const rs = await Promise.all([
      ...Array.from({ length: 4 }, () => order([{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }])),
      ...Array.from({ length: 4 }, () => order([{ productId: b.id, quantity: 1 }, { productId: a.id, quantity: 1 }])),
    ]);
    expect(rs.map((r) => r.status)).toEqual(Array(8).fill(201));
    expect(await stockOf(a.id)).toBe(1);
    expect(await stockOf(b.id)).toBe(1);
  });

  it("pedido e cancelamento concorrentes mantêm o saldo consistente", async () => {
    const p = await makeProduct({ stockQuantity: 2 });
    const first = await order([{ productId: p.id, quantity: 2 }]);
    const [cancel, neu] = await Promise.all([
      setStatus(first.body.data.id, "CANCELLED"),
      order([{ productId: p.id, quantity: 2 }]),
    ]);
    expect(cancel.status).toBe(200);
    expect([201, 409]).toContain(neu.status);
    expect(await stockOf(p.id)).toBe(neu.status === 201 ? 0 : 2);
  });
});

describe("expectedStockQuantity", () => {
  const patch = (id: string, body: object) => api().patch(`/api/products/${id}`).send(body);

  it("igual ao atual -> 200 e aplica", async () => {
    const p = await makeProduct({ stockQuantity: 10 });
    const res = await patch(p.id, { stockQuantity: 20, expectedStockQuantity: 10 });
    expect(res.status).toBe(200);
    expect(await stockOf(p.id)).toBe(20);
  });

  it("diferente -> 409 STOCK_CHANGED sem alterar a linha", async () => {
    const p = await makeProduct({ stockQuantity: 10 });
    await order([{ productId: p.id, quantity: 3 }]);
    const res = await patch(p.id, { name: "Outro", stockQuantity: 20, expectedStockQuantity: 10 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STOCK_CHANGED");
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.stockQuantity).toBe(7);
    expect(row.name).toBe("Agua");
  });

  it("ausente -> sobrescreve como antes", async () => {
    const p = await makeProduct({ stockQuantity: 10 });
    await order([{ productId: p.id, quantity: 3 }]);
    const res = await patch(p.id, { stockQuantity: 20 });
    expect(res.status).toBe(200);
    expect(await stockOf(p.id)).toBe(20);
  });
});
