import type { Order, OrderStatus } from "@marcai/shared";
import { prisma, type Prisma } from "../config/prisma.js";
import type { DayRange, Tx } from "./booking.model.js";

type DbOrder = Prisma.OrderGetPayload<{ include: { items: true } }>;

export function toOrderDto(o: DbOrder): Order {
  return {
    id: o.id,
    bookingId: o.bookingId,
    customerName: o.customerName,
    status: o.status,
    total: o.total.toNumber(),
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toNumber(),
      subtotal: i.subtotal.toNumber(),
    })),
  };
}

export interface NewOrderData {
  bookingId: string | null;
  customerName: string | null;
  total: Prisma.Decimal;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }[];
}

export const orderModel = {
  async list(filter: { status?: OrderStatus; range?: DayRange }): Promise<Order[]> {
    const rows = await prisma.order.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.range ? { createdAt: { gte: filter.range.start, lt: filter.range.end } } : {}),
      },
      include: { items: { orderBy: { id: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrderDto);
  },

  async create(db: Tx, data: NewOrderData): Promise<Order> {
    const row = await db.order.create({
      data: {
        bookingId: data.bookingId,
        customerName: data.customerName,
        total: data.total,
        items: { create: data.items },
      },
      include: { items: { orderBy: { id: "asc" } } },
    });
    return toOrderDto(row);
  },

  /** Muda o status só se o pedido ainda está OPEN (atômico). Devolve null se não mudou. */
  async closeIfOpen(id: string, status: "PAID" | "CANCELLED"): Promise<Order | null> {
    const { count } = await prisma.order.updateMany({ where: { id, status: "OPEN" }, data: { status } });
    if (count === 0) return null;
    const row = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { id: "asc" } } },
    });
    return toOrderDto(row);
  },

  exists(id: string): Promise<boolean> {
    return prisma.order.count({ where: { id } }).then((n) => n > 0);
  },

  countOpen(): Promise<number> {
    return prisma.order.count({ where: { status: "OPEN" } });
  },

  async sumPaidTotal(range: DayRange): Promise<number> {
    const r = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: "PAID", createdAt: { gte: range.start, lt: range.end } },
    });
    return r._sum.total?.toNumber() ?? 0;
  },
};
