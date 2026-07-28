import { z } from 'zod'
import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from '@/services/api'
import { parseWith } from '@/lib/parseResponse'
import {
  activeTableSchema,
  waiterTableSchema,
  type ActiveTable,
  type ActiveTableItem,
  type WaiterTable,
} from '@/lib/schemas/dashboard'

type QueryError = { status?: number; data?: unknown; message?: string }

const parseWaiterTables = parseWith(z.array(waiterTableSchema))
const parseActiveTables = parseWith(z.array(activeTableSchema))

// ── TEMPORARY DEBT — DELETE THIS WHOLE BLOCK WHEN `GET /waiter/tables` DEPLOYS ──
//
// `/waiter/tables` currently 404s in production (the route is written but not
// released). Everything between here and `dashboardApi` exists only to keep the
// grid usable until it ships, and all of it comes out in one piece afterwards:
// delete the helpers, delete the 404 branch in `queryFn`, keep the happy path.
//
// While the fallback is live the grid is occupied-only for every role that
// reaches this screen (WAITER and COUNTER), because /dashboard/active-tables
// knows nothing about empty tables — Available cards simply don't appear.
//
// Do not widen this: no new roles, no new endpoints composed on top of it.

/** Merge line items by product name across every open order on the table. */
function mergeItems(orders: ActiveTable['orders']): ActiveTableItem[] {
  const merged = new Map<string, ActiveTableItem>()
  for (const order of orders) {
    for (const item of order.items) {
      const seen = merged.get(item.name)
      if (seen) seen.quantity += item.quantity
      else merged.set(item.name, { name: item.name, quantity: item.quantity })
    }
  }
  return [...merged.values()]
}

/**
 * Every row from `/dashboard/active-tables` is occupied by definition — the
 * endpoint only knows about tables holding at least one OPEN order.
 */
function occupiedToWaiterTable(t: ActiveTable): WaiterTable {
  return {
    table_id: t.table_id,
    table_label: t.table_label,
    occupied: true,
    order_count: t.order_count,
    earliest_placed_at: t.earliest_placed_at,
    // Already a Decimal string from the backend — passed through untouched.
    total_amount: t.total_amount,
    items: mergeItems(t.orders),
    orders: t.orders,
  }
}

// ── END TEMPORARY DEBT ────────────────────────────────────────────────────────

/**
 * Dashboard read-endpoints. Only the floor view is exposed to staff
 * (WAITER/COUNTER) — the analytics routes stay ADMIN-only server-side, so they
 * are deliberately not modelled here.
 */
export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['WaiterTables'],
  endpoints: (builder) => ({
    getWaiterTables: builder.query<WaiterTable[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const full = await baseQuery({ method: 'GET', url: '/waiter/tables' })

        if (!full.error) {
          try {
            return { data: parseWaiterTables(full.data) }
          } catch (e) {
            return { error: { message: (e as Error).message } satisfies QueryError }
          }
        }

        // Only a missing route falls back. A 401/403/500 is a real failure and
        // must surface as an error — never a silently half-populated floor.
        if ((full.error as QueryError).status !== 404) {
          return { error: full.error as QueryError }
        }

        // TEMPORARY DEBT — see the block above.
        const legacy = await baseQuery({ method: 'GET', url: '/dashboard/active-tables' })
        if (legacy.error) return { error: legacy.error as QueryError }

        try {
          return { data: parseActiveTables(legacy.data).map(occupiedToWaiterTable) }
        } catch (e) {
          return { error: { message: (e as Error).message } satisfies QueryError }
        }
      },
      providesTags: ['WaiterTables'],
    }),
  }),
})

export const { useGetWaiterTablesQuery } = dashboardApi
