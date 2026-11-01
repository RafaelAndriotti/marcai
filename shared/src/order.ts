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
  bookingId: z.string().min(1).optional(),
  /** Opcional; se omitido e houver bookingId, o servidor usa o cliente da reserva. */
  customerName: z.string().trim().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
