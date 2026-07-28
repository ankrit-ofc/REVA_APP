import { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { QueryState } from '@/components/QueryState'
import {
  useGetKitchenQueueQuery,
  useMarkPreparingMutation,
  useMarkReadyMutation,
  useCancelItemMutation,
} from '@/features/kitchen/kitchenApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { errDetail } from '@/lib/errors'
import type { QueueItemResponse } from '@/lib/schemas/workflow'
import { colors, spacing } from '@/theme'

const REFETCH_EVENTS = new Set(['order.created', 'order_item.status_changed', 'order.status_changed'])

export function KitchenScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetKitchenQueueQuery()
  const [markPreparing] = useMarkPreparingMutation()
  const [markReady] = useMarkReadyMutation()
  const [cancelItem] = useCancelItemMutation()

  // Item ids with a mutation in flight — only the tapped card's button spins;
  // every other card stays tappable.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) refetch()
      },
      [refetch],
    ),
  )

  // The cache patch in kitchenApi moves the card instantly; on failure the patch
  // is undone (card snaps back) and the alert makes the failure explicit — a
  // silently reverted "done" must never pass for a done item.
  const runItemAction = useCallback(
    async (
      itemId: string,
      trigger: (id: string) => { unwrap: () => Promise<unknown> },
      failTitle: string,
    ) => {
      setPendingIds((prev) => new Set(prev).add(itemId))
      try {
        await trigger(itemId).unwrap()
      } catch (e) {
        Alert.alert(failTitle, `${errDetail(e)}\n\nThe item was NOT updated — please try again.`)
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    },
    [],
  )

  const renderItem = useCallback(
    ({ item }: { item: QueueItemResponse }) => (
      <Card>
        <View style={styles.rowTop}>
          <Ionicons name="receipt-outline" size={16} color={colors.textMuted} style={styles.orderIcon} />
          <Text style={styles.orderNo}>#{item.order_number}</Text>
          {item.table_name ? <Text style={styles.table}>{item.table_name}</Text> : null}
          <View style={styles.flex} />
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.product}>
          {item.quantity}× {item.product_name}
          {item.variant_name ? ` · ${item.variant_name}` : ''}
        </Text>
        {item.addons.length > 0 ? (
          <Text style={styles.addons}>+ {item.addons.map((a) => a.addon_name).join(', ')}</Text>
        ) : null}
        {item.special_instructions ? (
          <Text style={styles.instructions}>“{item.special_instructions}”</Text>
        ) : null}
        <View style={styles.actions}>
          {item.status === 'NEW' ? (
            <View style={styles.flex}>
              <Button
                title="Start preparing"
                loading={pendingIds.has(item.id)}
                onPress={() => runItemAction(item.id, markPreparing, 'Could not start preparing')}
              />
            </View>
          ) : null}
          {item.status === 'PREPARING' ? (
            <View style={styles.flex}>
              <Button
                title="Mark ready"
                variant="success"
                loading={pendingIds.has(item.id)}
                onPress={() => runItemAction(item.id, markReady, 'Could not mark ready')}
              />
            </View>
          ) : null}
          <View style={{ width: spacing.sm }} />
          <Button title="Cancel" variant="secondary" onPress={() => cancelItem(item.id)} />
        </View>
      </Card>
    ),
    [pendingIds, runItemAction, markPreparing, markReady, cancelItem],
  )

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No items in the queue."
            emptyIcon="restaurant-outline"
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  flex: { flex: 1 },
  orderIcon: { marginRight: spacing.xs },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 13, color: colors.textMuted },
  product: { fontSize: 16, fontWeight: '600', color: colors.text },
  addons: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  instructions: { fontSize: 13, color: colors.warning, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
})
