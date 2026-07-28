import { useCallback, useMemo, useState } from 'react'
import { Alert, ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { QueryState } from '@/components/QueryState'
import {
  useGetPendingApprovalsQuery,
  useGetOpenOrdersQuery,
  useApproveOrderItemsMutation,
  useRejectOrderItemsMutation,
  useMarkMealFinishedMutation,
} from '@/features/waiter/waiterApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { errDetail } from '@/lib/errors'
import type { QueueItemResponse } from '@/lib/schemas/workflow'
import { colors, spacing } from '@/theme'

interface PendingGroup {
  orderId: string
  orderNumber: number
  tableName: string
  items: QueueItemResponse[]
}

const REFETCH_EVENTS = new Set([
  'order.created',
  'order.status_changed',
  'bill.requested',
  'order.approval_requested',
  'order.approval_decided',
  'order_item.status_changed',
])

export function WaiterOrdersScreen() {
  const pendingQ = useGetPendingApprovalsQuery(undefined, { pollingInterval: 15_000 })
  const openQ = useGetOpenOrdersQuery(undefined, { pollingInterval: 15_000 })
  const [approve] = useApproveOrderItemsMutation()
  const [reject] = useRejectOrderItemsMutation()
  const [markMealFinished] = useMarkMealFinishedMutation()

  // Per-order in-flight decision — only the tapped button spins (its sibling is
  // disabled so one order can't get both decisions); other cards stay tappable.
  const [pendingByOrder, setPendingByOrder] = useState<ReadonlyMap<string, 'approve' | 'reject'>>(
    new Map(),
  )

  // The cache patch in waiterApi removes the whole batch card instantly; on
  // failure the patch is undone (card snaps back) and the alert makes the
  // failure explicit.
  const decide = useCallback(
    async (orderId: string, action: 'approve' | 'reject') => {
      setPendingByOrder((prev) => new Map(prev).set(orderId, action))
      try {
        await (action === 'approve' ? approve({ orderId }) : reject({ orderId })).unwrap()
      } catch (e) {
        Alert.alert(
          action === 'approve' ? 'Approval failed' : 'Rejection failed',
          `${errDetail(e)}\n\nThe order was NOT ${action === 'approve' ? 'approved' : 'rejected'} — please try again.`,
        )
      } finally {
        setPendingByOrder((prev) => {
          const next = new Map(prev)
          next.delete(orderId)
          return next
        })
      }
    },
    [approve, reject],
  )

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) {
          pendingQ.refetch()
          openQ.refetch()
        }
      },
      [pendingQ, openQ],
    ),
  )

  const groups = useMemo<PendingGroup[]>(() => {
    const byOrder = new Map<string, PendingGroup>()
    for (const it of pendingQ.data ?? []) {
      const g = byOrder.get(it.order_id)
      if (g) {
        g.items.push(it)
      } else {
        byOrder.set(it.order_id, {
          orderId: it.order_id,
          orderNumber: it.order_number,
          tableName: it.table_name ?? '—',
          items: [it],
        })
      }
    }
    return [...byOrder.values()]
  }, [pendingQ.data])

  const open = openQ.data ?? []
  const loading = pendingQ.isLoading || openQ.isLoading

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={pendingQ.isFetching || openQ.isFetching}
            onRefresh={() => {
              pendingQ.refetch()
              openQ.refetch()
            }}
          />
        }
      >
        <View style={styles.sectionRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
          <Text style={styles.section}>Pending Approvals</Text>
        </View>
        {groups.length === 0 ? (
          <Text style={styles.muted}>No batches awaiting approval.</Text>
        ) : (
          groups.map((g) => (
            <Card key={g.orderId}>
              <View style={styles.rowTop}>
                <Text style={styles.orderNo}>#{g.orderNumber}</Text>
                <Text style={styles.table}>{g.tableName}</Text>
              </View>
              {g.items.map((it) => (
                <Text key={it.id} style={styles.product}>
                  {it.quantity}× {it.product_name}
                  {it.variant_name ? ` · ${it.variant_name}` : ''}
                  {it.special_instructions ? ` — “${it.special_instructions}”` : ''}
                </Text>
              ))}
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    title="Approve"
                    variant="success"
                    loading={pendingByOrder.get(g.orderId) === 'approve'}
                    disabled={pendingByOrder.get(g.orderId) === 'reject'}
                    onPress={() => decide(g.orderId, 'approve')}
                  />
                </View>
                <View style={{ width: spacing.sm }} />
                <View style={styles.flex}>
                  <Button
                    title="Reject"
                    variant="danger"
                    loading={pendingByOrder.get(g.orderId) === 'reject'}
                    disabled={pendingByOrder.get(g.orderId) === 'approve'}
                    onPress={() => decide(g.orderId, 'reject')}
                  />
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={styles.sectionRow}>
          <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
          <Text style={styles.section}>Open Tables</Text>
        </View>
        {open.length === 0 ? (
          <Text style={styles.muted}>No open tables.</Text>
        ) : (
          open.map((o) => (
            <Card key={o.id}>
              <View style={styles.rowTop}>
                <Text style={styles.orderNo}>#{o.order_number}</Text>
                <Text style={styles.table}>{o.table_name}</Text>
                <View style={styles.flex} />
                <Text style={styles.items}>
                  {o.item_count} item{o.item_count !== 1 ? 's' : ''}
                </Text>
              </View>
              {o.pending_item_count > 0 ? (
                <Text style={styles.pending}>{o.pending_item_count} awaiting approval</Text>
              ) : null}
              {o.bill_requested ? (
                <View style={styles.billRow}>
                  <Ionicons name="notifications-outline" size={14} color={colors.warning} />
                  <Text style={styles.billRequested}>Bill requested</Text>
                </View>
              ) : null}
              {/*
                "Move to billing" HIDDEN 2026-07-25 per request. Code intact —
                markMealFinished hook + mutation untouched. All billing now
                funnels through Bill & clear (OPEN + bill_requested) on the
                Billing screen; this was the last UI path into MEAL_FINISHED, so
                hiding it stops new "Ready for Billing" tables. Uncomment (button
                + preceding spacer) to restore.
              */}
              {/*
              <View style={{ height: spacing.sm }} />
              <Button
                title="Move to billing"
                disabled={!o.bill_requested}
                onPress={() => markMealFinished(o.id)}
              />
              */}
            </Card>
          ))
        )}

        <QueryState
          loading={loading}
          error={pendingQ.isError || openQ.isError}
          empty={false}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  section: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  flex: { flex: 1 },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 14, color: colors.text },
  items: { fontSize: 13, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  product: { fontSize: 14, color: colors.text, marginBottom: 2 },
  pending: { fontSize: 13, color: colors.warning, fontWeight: '600', marginTop: 2 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  billRequested: { fontSize: 13, color: colors.warning, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
})
