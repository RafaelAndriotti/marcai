import { z } from "zod";
import { orderStatusSchema, type OrderStatus } from "./enums.js";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  bookingId: string | null;
  customerName: string | null;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export const createOrderSchema = z.object({
  bookingId: z.string().min(1).max(64).optional(),
  /** Opcional; se omitido e houver bookingId, o servidor usa o cliente da reserva. */
  customerName: z.string().trim().min(1).max(80).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
      message: "duplicate productId; merge quantities into a single item",
    }),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  /** Só pedido OPEN muda de status, e só para PAID ou CANCELLED. */
  status: z.enum(["PAID", "CANCELLED"]),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  /** Dia local (YYYY-MM-DD) de criação do pedido. */
  date: z.iso.date().optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
