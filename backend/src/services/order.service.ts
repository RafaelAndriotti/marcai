import {
  MAX_MONEY,
  type CreateOrderInput,
  type ListOrdersQuery,
  type Order,
  type UpdateOrderStatusInput,
} from "@marcai/shared";
import { Prisma, prisma } from "../config/prisma.js";
import { orderModel } from "../models/order.model.js";
import { localDayRange } from "../utils/date.js";
import { AppError } from "../utils/errors.js";

const ROUND = Prisma.Decimal.ROUND_HALF_UP;

const MAX_DECIMAL = new Prisma.Decimal(MAX_MONEY.toFixed(2));
const overflow = (): AppError => AppError.validation("total", "order total is too large");

export const orderService = {
  list(query: ListOrdersQuery): Promise<Order[]> {
    return orderModel.list({
      status: query.status,
      range: query.date ? localDayRange(query.date) : undefined,
    });
  },

  async updateStatus(id: string, status: UpdateOrderStatusInput["status"]): Promise<Order> {
    const order = await orderModel.closeIfOpen(id, status);
    if (order) return order;
    if (!(await orderModel.exists(id))) throw AppError.notFound("Pedido não encontrado");
    throw new AppError(409, "ORDER_NOT_OPEN", "Só pedidos abertos podem mudar de status");
  },

  create(input: CreateOrderInput): Promise<Order> {
    // lookup de reserva/produtos e insert na mesma transação
    return prisma.$transaction(async (tx) => {
      let customerName: string | null = input.customerName ?? null;
      if (input.bookingId) {
        const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
        if (!booking) throw AppError.notFound("Reserva não encontrada");
        if (booking.status === "CANCELLED") throw AppError.validation("bookingId", "booking is cancelled");
        customerName ??= booking.customerName;
      }

      const ids = [...new Set(input.items.map((i) => i.productId))];
      // FOR UPDATE: impede alterar preço/active/estoque dos produtos até o fim da transação
      const found = await tx.$queryRaw<
        { id: string; name: string; active: boolean; price: Prisma.Decimal; stockQuantity: number }[]
      >`SELECT id, name, active, price, "stockQuantity" FROM "Product" WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
      const products = new Map(found.map((p) => [p.id, p]));

      let total = new Prisma.Decimal(0);
      const items = input.items.map((item, idx) => {
        const product = products.get(item.productId);
        if (!product) throw AppError.notFound("Produto não encontrado", { productId: item.productId });
        if (!product.active) {
          throw AppError.validation(`items[${idx}].productId`, "product is inactive");
        }
        const subtotal = product.price.mul(item.quantity).toDecimalPlaces(2, ROUND);
        if (subtotal.gt(MAX_DECIMAL)) throw overflow();
        total = total.add(subtotal);
        if (total.gt(MAX_DECIMAL)) throw overflow();
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          subtotal,
        };
      });

      // soma quantidades do mesmo produto e baixa o estoque (linhas já travadas)
      const wanted = new Map<string, number>();
      for (const i of items) wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.quantity);
      for (const [productId, n] of wanted) {
        const available = products.get(productId)!.stockQuantity;
        if (n > available) {
          throw new AppError(409, "INSUFFICIENT_STOCK", "Estoque insuficiente", { productId, available });
        }
        await tx.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: n } } });
      }

      return orderModel.create(tx, {
        bookingId: input.bookingId ?? null,
        customerName,
        total: total.toDecimalPlaces(2, ROUND),
        items,
      });
    });
  },
};
