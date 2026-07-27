import { z } from 'zod'
import { orderStatusSchema } from './order'

/**
 * Read-only schemas for the admin dashboard's "Active Tables" widget, which the
 * staff app reuses for its Tables screen. `total_amount` is a running tab the
 * backend serializes as a Decimal **string** (Pydantic v2) — coerce it, same as
 * every other money field (see order.ts / parseResponse.ts).
 */
export const activeTableItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int(),
})

export const activeTableOrderSchema = z.object({
  order_id: z.string().uuid(),
  order_number: z.number().int(),
  status: orderStatusSchema,
  placed_at: z.string(),
  items: z.array(activeTableItemSchema),
})

export const activeTableSchema = z.object({
  table_id: z.string().uuid(),
  table_label: z.string(),
  order_count: z.number().int(),
  earliest_placed_at: z.string(),
  total_amount: z.coerce.number(),
  orders: z.array(activeTableOrderSchema),
})

/**
 * Floor-map row from GET /waiter/tables. Money stays a string (never float).
 * `items` is the merged non-cancelled line list for the card; `orders` keeps
 * the per-order breakdown (typically 0–1 OPEN order per table today).
 */
export const waiterTableSchema = z.object({
  table_id: z.string().uuid(),
  table_label: z.string(),
  occupied: z.boolean(),
  order_count: z.number().int(),
  earliest_placed_at: z.string().nullable(),
  total_amount: z.string(),
  items: z.array(activeTableItemSchema),
  orders: z.array(activeTableOrderSchema),
})

export type ActiveTableItem = z.infer<typeof activeTableItemSchema>
export type ActiveTableOrder = z.infer<typeof activeTableOrderSchema>
export type ActiveTable = z.infer<typeof activeTableSchema>
export type WaiterTable = z.infer<typeof waiterTableSchema>
