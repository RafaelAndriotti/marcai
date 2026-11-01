import type { CreateOrderInput, ListOrdersQuery, Order } from "@marcai/shared";
import { Prisma, prisma } from "../config/prisma.js";
import { orderModel } from "../models/order.model.js";
import { AppError } from "../utils/errors.js";

const ROUND = Prisma.Decimal.ROUND_HALF_UP;

export const orderService = {
  list(query: ListOrdersQuery): Promise<Order[]> {
    return orderModel.list(query.status);
  },

  create(input: CreateOrderInput): Promise<Order> {
    // lookup de reserva/produtos e insert na mesma transação
    return prisma.$transaction(async (tx) => {
      let customerName: string | null = input.customerName ?? null;
      if (input.bookingId) {
        const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
        if (!booking) throw AppError.notFound("Reserva não encontrada");
        customerName ??= booking.customerName;
      }

      const ids = [...new Set(input.items.map((i) => i.productId))];
      const found = await tx.product.findMany({ where: { id: { in: ids } } });
      const products = new Map(found.map((p) => [p.id, p]));

      let total = new Prisma.Decimal(0);
      const items = input.items.map((item, idx) => {
        const product = products.get(item.productId);
        if (!product) throw AppError.notFound(`Produto não encontrado: ${item.productId}`);
        if (!product.active) {
          throw AppError.validation(`items[${idx}].productId`, "product is inactive");
        }
        const subtotal = product.price.mul(item.quantity).toDecimalPlaces(2, ROUND);
        total = total.add(subtotal);
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          subtotal,
        };
      });

      return orderModel.create(tx, {
        bookingId: input.bookingId ?? null,
        customerName,
        total: total.toDecimalPlaces(2, ROUND),
        items,
      });
    });
  },
};
