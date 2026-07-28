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

/**
 * TEMPORARY DEBT — DELETE WHEN `GET /waiter/tables` DEPLOYS.
 *
 * `/waiter/tables` currently 404s in production (the route is written but not
 * released). Until it ships we degrade to `/dashboard/active-tables`, which only
 * knows about **occupied** tables — so waiters see an occupied-only grid and
 * available tables are simply missing. That is the accepted interim behaviour.
 *
 * Adapting is lossy and one-way: every row from the legacy endpoint is occupied
 * by definition, and `items` has to be re-merged here because the legacy payload
 * only carries per-order items. Do not build on this shim and do not extend it to
 * other roles — remove `adaptLegacyActiveTables` and this whole fallback branch
 * the moment the real endpoint is live.
 */
function adaptLegacyActiveTables(rows: ActiveTable[]): WaiterTable[] {
  return rows.map((t) => {
    // A table can hold several open orders; merge their items by name so the
    // card shows one line per product rather than one per order.
    const merged = new Map<string, ActiveTableItem>()
    for (const order of t.orders) {
      for (const item of order.items) {
        const seen = merged.get(item.name)
        if (seen) seen.quantity += item.quantity
        else merged.set(item.name, { name: item.name, quantity: item.quantity })
      }
    }
    return {
      table_id: t.table_id,
      table_label: t.table_label,
      occupied: true,
      order_count: t.order_count,
      earliest_placed_at: t.earliest_placed_at,
      total_amount: t.total_amount,
      items: [...merged.values()],
      orders: t.orders,
    }
  })
}

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

        // Only a missing route falls back — a 401/500 is a real failure.
        if ((full.error as QueryError).status !== 404) {
          return { error: full.error as QueryError }
        }

        // TEMPORARY DEBT — see adaptLegacyActiveTables above.
        const legacy = await baseQuery({ method: 'GET', url: '/dashboard/active-tables' })
        if (legacy.error) return { error: legacy.error as QueryError }
        try {
          return { data: adaptLegacyActiveTables(parseActiveTables(legacy.data)) }
        } catch (e) {
          return { error: { message: (e as Error).message } satisfies QueryError }
        }
      },
      providesTags: ['WaiterTables'],
    }),
  }),
})

export const { useGetWaiterTablesQuery } = dashboardApi
