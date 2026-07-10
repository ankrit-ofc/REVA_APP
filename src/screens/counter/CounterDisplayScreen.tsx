import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { StatusBadge } from '@/components/StatusBadge'
import { QueryState } from '@/components/QueryState'
import { useGetBoardQuery } from '@/features/counterDisplay/counterDisplayApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { colors, radius, spacing } from '@/theme'

/** Passive wall board: read-only view of items and their live status. */
export function CounterDisplayScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetBoardQuery(undefined, {
    pollingInterval: 15_000,
  })

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (ev.type === 'order.created' || ev.type === 'order_item.status_changed') refetch()
      },
      [refetch],
    ),
  )

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.orderNo}>#{item.order_number}</Text>
            <View style={styles.flex}>
              <Text style={styles.product}>
                {item.quantity}× {item.product_name}
                {item.variant_name ? ` · ${item.variant_name}` : ''}
              </Text>
              <Text style={styles.table}>{item.table_name}</Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No active items."
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  flex: { flex: 1 },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.md },
  product: { fontSize: 15, fontWeight: '600', color: colors.text },
  table: { fontSize: 12, color: colors.textMuted },
})
