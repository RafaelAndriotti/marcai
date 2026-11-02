import { afterAll, beforeEach } from "vitest";

const url = process.env.DATABASE_URL ?? "";
if (!/\/marcai_test(\?|$)/.test(url)) {
  throw new Error(`Abortando: DATABASE_URL não aponta para marcai_test (${url})`);
}

const { prisma } = await import("../src/config/prisma.js");

beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.category.createMany({
    data: [
      { id: "cat_bebida", name: "Bebida" },
      { id: "cat_comida", name: "Comida" },
      { id: "cat_outro", name: "Outro" },
    ],
  });
  await prisma.court.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
