import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { QueryState } from '@/components/QueryState'
import { useGetReadyItemsQuery, useMarkServedMutation } from '@/features/waiter/waiterApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { StatusBadge } from '@/components/StatusBadge'
import { colors, spacing } from '@/theme'

/**
 * The to-serve queue: every approved, unserved item (NEW / PREPARING / READY).
 * Kitchens that cook off the printed KOT never mark items ready, so the waiter
 * serves directly from NEW.
 */
export function WaiterReadyScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetReadyItemsQuery()
  const [markServed, { isLoading: busy }] = useMarkServedMutation()

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (
          ev.type === 'order_item.status_changed' ||
          ev.type === 'order.created' ||
          ev.type === 'order.approval_decided'
        )
          refetch()
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
            <View style={{ height: spacing.sm }} />
            <Button title="Mark served" variant="success" disabled={busy} onPress={() => markServed(item.id)} />
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="Nothing to serve."
            emptyIcon="checkmark-done-outline"
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  flex: { flex: 1 },
  orderIcon: { marginRight: spacing.xs },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 13, color: colors.textMuted },
  product: { fontSize: 16, fontWeight: '600', color: colors.text },
  addons: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
})
