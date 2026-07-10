import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
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
import type { QueueItemResponse } from '@/lib/schemas/workflow'
import { colors, spacing } from '@/theme'

const REFETCH_EVENTS = new Set(['order.created', 'order_item.status_changed', 'order.status_changed'])

export function KitchenScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetKitchenQueueQuery()
  const [markPreparing, { isLoading: preparingBusy }] = useMarkPreparingMutation()
  const [markReady, { isLoading: readyBusy }] = useMarkReadyMutation()
  const [cancelItem] = useCancelItemMutation()

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) refetch()
      },
      [refetch],
    ),
  )

  const busy = preparingBusy || readyBusy

  const renderItem = useCallback(
    ({ item }: { item: QueueItemResponse }) => (
      <Card>
        <View style={styles.rowTop}>
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
              <Button title="Start preparing" onPress={() => markPreparing(item.id)} disabled={busy} />
            </View>
          ) : null}
          {item.status === 'PREPARING' ? (
            <View style={styles.flex}>
              <Button
                title="Mark ready"
                variant="success"
                onPress={() => markReady(item.id)}
                disabled={busy}
              />
            </View>
          ) : null}
          <View style={{ width: spacing.sm }} />
          <Button title="Cancel" variant="secondary" onPress={() => cancelItem(item.id)} />
        </View>
      </Card>
    ),
    [busy, markPreparing, markReady, cancelItem],
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
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 13, color: colors.textMuted },
  product: { fontSize: 16, fontWeight: '600', color: colors.text },
  addons: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  instructions: { fontSize: 13, color: colors.warning, marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
})
