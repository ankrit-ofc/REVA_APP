import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { QueryState } from '@/components/QueryState'
import { useGetReadyItemsQuery, useMarkServedMutation } from '@/features/waiter/waiterApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { colors, spacing } from '@/theme'

/** READY items waiting to be carried to the table. */
export function WaiterReadyScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetReadyItemsQuery()
  const [markServed, { isLoading: busy }] = useMarkServedMutation()

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (ev.type === 'order_item.status_changed' || ev.type === 'order.created') refetch()
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
          <Card>
            <View style={styles.rowTop}>
              <Text style={styles.orderNo}>#{item.order_number}</Text>
              {item.table_name ? <Text style={styles.table}>{item.table_name}</Text> : null}
            </View>
            <Text style={styles.product}>
              {item.quantity}× {item.product_name}
              {item.variant_name ? ` · ${item.variant_name}` : ''}
            </Text>
            {item.addons.length > 0 ? (
              <Text style={styles.addons}>+ {item.addons.map((a) => a.addon_name).join(', ')}</Text>
            ) : null}
            <View style={{ height: spacing.sm }} />
            <Button title="Mark served" variant="success" disabled={busy} onPress={() => markServed(item.id)} />
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="Nothing ready to serve."
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 13, color: colors.textMuted },
  product: { fontSize: 16, fontWeight: '600', color: colors.text },
  addons: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
})
