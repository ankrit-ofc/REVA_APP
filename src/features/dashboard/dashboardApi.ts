import { z } from 'zod'
import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from '@/services/api'
import { parseWith } from '@/lib/parseResponse'
import { activeTableSchema, type ActiveTable } from '@/lib/schemas/dashboard'

/**
 * Dashboard read-endpoints. Only `active-tables` is exposed to floor staff
 * (WAITER/COUNTER) — the analytics routes stay ADMIN-only server-side, so they
 * are deliberately not modelled here.
 */
export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['ActiveTables'],
  endpoints: (builder) => ({
    getActiveTables: builder.query<ActiveTable[], void>({
      query: () => ({ method: 'GET', url: '/dashboard/active-tables' }),
      // Coerce the Decimal-as-string running tab (total_amount) to a number.
      transformResponse: parseWith(z.array(activeTableSchema)),
      providesTags: ['ActiveTables'],
    }),
  }),
})

export const { useGetActiveTablesQuery } = dashboardApi
