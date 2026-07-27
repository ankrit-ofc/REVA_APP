import { z } from 'zod'
import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from '@/services/api'
import { parseWith } from '@/lib/parseResponse'
import {
  activeTableSchema,
  waiterTableSchema,
  type ActiveTable,
  type WaiterTable,
} from '@/lib/schemas/dashboard'

/**
 * Merge order line items by product name (same rule as backend waiter_tables).
 */
function mergeItems(orders: ActiveTable['orders']): WaiterTable['items'] {
  const qty = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      qty.set(item.name, (qty.get(item.name) ?? 0) + item.quantity)
    }
  }
  return [...qty.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, quantity]) => ({ name, quantity }))
}

/** Map occupied-only active-tables rows into the floor-map WaiterTable shape. */
function activeToWaiter(t: ActiveTable): WaiterTable {
  return {
    table_id: t.table_id,
    table_label: t.table_label,
    occupied: true,
    order_count: t.order_count,
    earliest_placed_at: t.earliest_placed_at,
    total_amount: Number(t.total_amount).toFixed(2),
    items: mergeItems(t.orders),
    orders: t.orders,
  }
}

/**
 * Build full floor (Available + Occupied) from admin table list + occupancy.
 * Loose parse — production payloads may omit/extra fields; never throw.
 */
function mergeAdminFloor(adminData: unknown, occupied: ActiveTable[]): WaiterTable[] | null {
  if (!Array.isArray(adminData)) return null

  const byId = new Map(occupied.map((t) => [t.table_id, t]))
  const rows: WaiterTable[] = []

  for (const raw of adminData) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Record<string, unknown>
    if (t.is_active === false) continue
    const id = typeof t.id === 'string' ? t.id : null
    const name = typeof t.name === 'string' ? t.name : null
    if (!id || !name) continue

    const occ = byId.get(id)
    if (occ) {
      rows.push(activeToWaiter(occ))
    } else {
      rows.push({
        table_id: id,
        table_label: name,
        occupied: false,
        order_count: 0,
        earliest_placed_at: null,
        total_amount: '0.00',
        items: [],
        orders: [],
      })
    }
  }

  return rows.length > 0 ? rows : null
}

/**
 * Dashboard / floor-map reads.
 *
 * Prefers GET /waiter/tables (all tables + Available). On production that route
 * may still be missing (404) — then ADMIN can compose the floor via
 * /admin/tables + /dashboard/active-tables. Waiter/Counter without the new
 * route only see occupied tables until the backend is deployed.
 */
export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['ActiveTables'],
  endpoints: (builder) => ({
    getActiveTables: builder.query<ActiveTable[], void>({
      query: () => ({ method: 'GET', url: '/dashboard/active-tables' }),
      transformResponse: parseWith(z.array(activeTableSchema)),
      providesTags: ['ActiveTables'],
    }),
    getWaiterTables: builder.query<WaiterTable[], void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const primary = await baseQuery({ method: 'GET', url: '/waiter/tables' })
        if (!primary.error) {
          try {
            return { data: parseWith(z.array(waiterTableSchema))(primary.data) }
          } catch (e) {
            return {
              error: {
                status: undefined,
                message: e instanceof Error ? e.message : 'Invalid waiter/tables response',
              },
            }
          }
        }

        // Not deployed yet, or transient error — try compose path for ADMIN.
        const status = primary.error.status
        if (status != null && status !== 404) {
          // Still try admin compose on 403/401 from waiter path — shouldn't happen
          // for authenticated floor staff, but don't block ADMIN merge.
          if (status !== 401 && status !== 403) {
            return { error: primary.error }
          }
        }

        const activeRes = await baseQuery({
          method: 'GET',
          url: '/dashboard/active-tables',
        })
        if (activeRes.error) {
          return { error: activeRes.error }
        }

        let occupied: ActiveTable[]
        try {
          occupied = parseWith(z.array(activeTableSchema))(activeRes.data)
        } catch (e) {
          return {
            error: {
              status: undefined,
              message: e instanceof Error ? e.message : 'Invalid active-tables response',
            },
          }
        }

        const adminRes = await baseQuery({ method: 'GET', url: '/admin/tables' })
        if (!adminRes.error) {
          const merged = mergeAdminFloor(adminRes.data, occupied)
          if (merged) return { data: merged }
        }

        // Waiter/Counter on prod without /waiter/tables: occupied only.
        return { data: occupied.map(activeToWaiter) }
      },
      providesTags: ['ActiveTables'],
    }),
  }),
})

export const { useGetActiveTablesQuery, useGetWaiterTablesQuery } = dashboardApi
