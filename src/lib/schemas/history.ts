import { z } from 'zod'

/**
 * Order-history rows from GET /counter/order-history.
 *
 * NOTE: `total` is intentionally a STRING (the backend serializes money as a
 * pre-formatted decimal string). It is validated as a string and displayed
 * verbatim with the currency — never coerced to a float, which would risk money
 * rounding. `invoice_id` is the stable key: order_number is NOT unique (a
 * re-invoiced order yields multiple rows sharing one order_number).
 */
export const orderHistoryStatusSchema = z.enum(['PAID', 'REFUNDED', 'VOID'])

export const orderHistoryRowSchema = z.object({
  invoice_id: z.string().uuid(),
  order_number: z.number().int(),
  table_name: z.string(),
  total: z.string(),
  currency: z.string(),
  status: orderHistoryStatusSchema,
  created_at: z.string(),
})

export const orderHistoryResponseSchema = z.object({
  items: z.array(orderHistoryRowSchema),
  total: z.number().int(),
  limit: z.number().int(),
})

export type OrderHistoryStatus = z.infer<typeof orderHistoryStatusSchema>
export type OrderHistoryRow = z.infer<typeof orderHistoryRowSchema>
export type OrderHistoryResponse = z.infer<typeof orderHistoryResponseSchema>
