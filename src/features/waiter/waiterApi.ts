import { z } from 'zod'
import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from '@/services/api'
import { parseWith } from '@/lib/parseResponse'
import {
  queueItemResponseSchema,
  waiterCallResponseSchema,
  type QueueItemResponse,
  type WaiterCallResponse,
} from '@/lib/schemas/workflow'
import {
  orderItemResponseSchema,
  orderResponseSchema,
  type CounterOrderSummary,
  type OrderItemResponse,
  type OrderResponse,
} from '@/lib/schemas/order'

export const waiterApi = createApi({
  reducerPath: 'waiterApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['WaiterQueue', 'WaiterOpenOrders', 'WaiterPending', 'WaiterCalls'],
  endpoints: (builder) => ({
    getWaiterCalls: builder.query<WaiterCallResponse[], void>({
      query: () => ({ method: 'GET', url: '/waiter/calls' }),
      transformResponse: parseWith(z.array(waiterCallResponseSchema)),
      providesTags: ['WaiterCalls'],
    }),
    attendWaiterCall: builder.mutation<WaiterCallResponse, string>({
      query: (callId) => ({ method: 'POST', url: `/waiter/calls/${callId}/attend` }),
      transformResponse: parseWith(waiterCallResponseSchema),
      invalidatesTags: ['WaiterCalls'],
    }),
    getReadyItems: builder.query<QueueItemResponse[], void>({
      query: () => ({ method: 'GET', url: '/waiter/ready' }),
      // Coerce Decimal-as-string money fields (unit_price, tax_rate, …).
      transformResponse: parseWith(z.array(queueItemResponseSchema)),
      providesTags: ['WaiterQueue'],
    }),
    getPendingApprovals: builder.query<QueueItemResponse[], void>({
      query: () => ({ method: 'GET', url: '/waiter/pending-approvals' }),
      transformResponse: parseWith(z.array(queueItemResponseSchema)),
      providesTags: ['WaiterPending'],
    }),
    getOpenOrders: builder.query<CounterOrderSummary[], void>({
      query: () => ({ method: 'GET', url: '/waiter/open-orders' }),
      providesTags: ['WaiterOpenOrders'],
    }),
    getBillingEnabled: builder.query<{ enabled: boolean }, void>({
      query: () => ({ method: 'GET', url: '/waiter/billing-enabled' }),
    }),
    markServed: builder.mutation<OrderItemResponse, string>({
      query: (itemId) => ({ method: 'POST', url: `/waiter/items/${itemId}/served` }),
      transformResponse: parseWith(orderItemResponseSchema),
      invalidatesTags: ['WaiterQueue'],
    }),
    markMealFinished: builder.mutation<OrderResponse, string>({
      query: (orderId) => ({
        method: 'POST',
        url: `/waiter/orders/${orderId}/meal-finished`,
      }),
      transformResponse: parseWith(orderResponseSchema),
      // The order leaves the OPEN queue once billing starts.
      invalidatesTags: ['WaiterOpenOrders'],
    }),
    reopenOrder: builder.mutation<OrderResponse, { orderId: string; reason: string }>({
      query: ({ orderId, reason }) => ({
        method: 'POST',
        url: `/waiter/orders/${orderId}/reopen`,
        data: { reason },
      }),
      transformResponse: parseWith(orderResponseSchema),
      invalidatesTags: ['WaiterOpenOrders', 'WaiterQueue'],
    }),
    approveOrderItems: builder.mutation<OrderResponse, { orderId: string }>({
      query: ({ orderId }) => ({
        method: 'POST',
        url: `/waiter/orders/${orderId}/approve`,
      }),
      transformResponse: parseWith(orderResponseSchema),
      invalidatesTags: ['WaiterOpenOrders', 'WaiterPending'],
    }),
    rejectOrderItems: builder.mutation<OrderResponse, { orderId: string; reason?: string }>({
      query: ({ orderId, reason }) => ({
        method: 'POST',
        url: `/waiter/orders/${orderId}/reject`,
        // reason is optional but, when present, must satisfy the 3–500 bound.
        data: reason ? { reason } : {},
      }),
      transformResponse: parseWith(orderResponseSchema),
      invalidatesTags: ['WaiterOpenOrders', 'WaiterPending'],
    }),
  }),
})

export const {
  useGetWaiterCallsQuery,
  useAttendWaiterCallMutation,
  useGetReadyItemsQuery,
  useGetPendingApprovalsQuery,
  useGetOpenOrdersQuery,
  useGetBillingEnabledQuery,
  useMarkServedMutation,
  useMarkMealFinishedMutation,
  useReopenOrderMutation,
  useApproveOrderItemsMutation,
  useRejectOrderItemsMutation,
} = waiterApi
