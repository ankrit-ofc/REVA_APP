import { useCallback, useLayoutEffect, useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Screen } from '@/components/Screen'
import { QueryState } from '@/components/QueryState'
import { TableCard } from '@/components/TableCard'
import { useGetWaiterTablesQuery } from '@/features/dashboard/dashboardApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import type { WaiterTable } from '@/lib/schemas/dashboard'
import { colors, spacing } from '@/theme'

const REFETCH_EVENTS = new Set([
  'order.created',
  'order.status_changed',
  'order.approval_requested',
  'order.approval_decided',
  'order_item.status_changed',
  'bill.requested',
  // Settling a bill frees the table — without these the green Available sticks until poll.
  'order.closed',
  'invoice.paid',
])

/** Natural sort so T2 precedes T10 (stable floor positions). */
function byTableLabel(a: WaiterTable, b: WaiterTable): number {
  return a.table_label.localeCompare(b.table_label, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

/**
 * Floor map for waiter/counter: every active table in a 2-column grid.
 * Occupancy from GET /waiter/tables (or prod fallback); name sort (not occupied-first).
 */
export function TablesScreen() {
  const navigation = useNavigation()
  const { data, isLoading, isError, isFetching, refetch } = useGetWaiterTablesQuery(undefined, {
    pollingInterval: 15_000,
  })

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) refetch()
      },
      [refetch],
    ),
  )

  const tables = useMemo(() => [...(data ?? [])].sort(byTableLabel), [data])
  const occupiedCount = useMemo(() => tables.filter((t) => t.occupied).length, [tables])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        tables.length > 0
          ? () => (
              <Text style={styles.headerCount}>
                {occupiedCount} of {tables.length} occupied
              </Text>
            )
          : undefined,
    })
  }, [navigation, occupiedCount, tables.length])

  return (
    <Screen>
      <FlatList
        data={tables}
        keyExtractor={(t) => t.table_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <TableCard table={item} />
          </View>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No tables set up yet."
            emptyIcon="restaurant-outline"
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    flexGrow: 1,
    gap: spacing.md,
  },
  headerCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginRight: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  cell: {
    flex: 1,
    maxWidth: '50%',
  },
})
