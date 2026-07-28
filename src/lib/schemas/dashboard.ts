import { z } from 'zod'
import { orderStatusSchema } from './order'

/**
 * Read-only schemas for the admin dashboard's "Active Tables" widget, which the
 * staff app reuses for its Tables screen. `total_amount` is a running tab the
 * backend serializes as a Decimal **string** (Pydantic v2) and it stays a string
 * the whole way through — never parsed to a float, which would round the money.
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
  total_amount: z.string(),
  orders: z.array(activeTableOrderSchema),
})

/**
 * The waiter floor view: **every** active table, occupied or not, as served by
 * `GET /waiter/tables`. Deactivated tables (`is_active = false`, a soft delete)
 * are excluded server-side and must never appear in the grid.
 *
 * `occupied` is derived, never stored — a table is occupied iff it has at least
 * one OPEN order. A table may hold several open orders at once: `items` is the
 * merged list across all of them (what the card shows), while `orders` keeps the
 * per-order breakdown. `earliest_placed_at` is null on an unoccupied table.
 *
 * `total_amount` is a Decimal string end to end — never parse it to a float.
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
