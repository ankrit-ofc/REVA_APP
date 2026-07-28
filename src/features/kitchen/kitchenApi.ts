import { z } from 'zod'
import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from '@/services/api'
import { parseWith } from '@/lib/parseResponse'
import { queueItemResponseSchema, type QueueItemResponse } from '@/lib/schemas/workflow'
import {
  orderItemResponseSchema,
  type OrderItemResponse,
  type OrderItemStatus,
} from '@/lib/schemas/order'

/**
 * Optimistically transition one queue item's status in the cached queue, so the
 * tapped card updates before the server round-trip. Rolled back via
 * `patchResult.undo()` on failure; the `invalidatesTags` refetch that follows a
 * successful mutation remains the server-truth reconciliation either way.
 */
function optimisticStatus(itemId: string, status: OrderItemStatus) {
  return kitchenApi.util.updateQueryData('getKitchenQueue', undefined, (draft) => {
    const item = draft.find((i) => i.id === itemId)
    if (item) item.status = status
  })
}

/**
 * Optimistically drop an item from the cached queue. The queue endpoint only
 * returns NEW/PREPARING items, so a READY item leaves the list — mirroring
 * that removal is the instant feedback for "Mark ready".
 */
function optimisticRemove(itemId: string) {
  return kitchenApi.util.updateQueryData('getKitchenQueue', undefined, (draft) =>
    draft.filter((i) => i.id !== itemId),
  )
}

export const kitchenApi = createApi({
  reducerPath: 'kitchenApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['KitchenQueue'],
  endpoints: (builder) => ({
    getKitchenQueue: builder.query<QueueItemResponse[], void>({
      query: () => ({ method: 'GET', url: '/kitchen/queue' }),
      // Coerce Decimal-as-string money fields (unit_price, tax_rate, …).
      transformResponse: parseWith(z.array(queueItemResponseSchema)),
      providesTags: ['KitchenQueue'],
    }),
    markPreparing: builder.mutation<OrderItemResponse, string>({
      query: (itemId) => ({ method: 'POST', url: `/kitchen/items/${itemId}/preparing` }),
      transformResponse: parseWith(orderItemResponseSchema),
      invalidatesTags: ['KitchenQueue'],
      async onQueryStarted(itemId, { dispatch, queryFulfilled }) {
        const patch = dispatch(optimisticStatus(itemId, 'PREPARING'))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
    markReady: builder.mutation<OrderItemResponse, string>({
      query: (itemId) => ({ method: 'POST', url: `/kitchen/items/${itemId}/ready` }),
      transformResponse: parseWith(orderItemResponseSchema),
      invalidatesTags: ['KitchenQueue'],
      async onQueryStarted(itemId, { dispatch, queryFulfilled }) {
        const patch = dispatch(optimisticRemove(itemId))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
    cancelItem: builder.mutation<OrderItemResponse, string>({
      query: (itemId) => ({ method: 'POST', url: `/kitchen/items/${itemId}/cancel` }),
      transformResponse: parseWith(orderItemResponseSchema),
      invalidatesTags: ['KitchenQueue'],
    }),
  }),
})

export const {
  useGetKitchenQueueQuery,
  useMarkPreparingMutation,
  useMarkReadyMutation,
  useCancelItemMutation,
} = kitchenApi
