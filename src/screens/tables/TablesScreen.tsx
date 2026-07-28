import { useCallback, useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { QueryState } from '@/components/QueryState'
import { TableCard } from '@/components/TableCard'
import { useGetWaiterTablesQuery } from '@/features/dashboard/dashboardApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import type { WaiterTable } from '@/lib/schemas/dashboard'
import { colors, spacing } from '@/theme'

// Occupancy is derived from open orders, so the grid moves whenever an order is
// created, transitions, is approved, closes, or its bill is settled.
const REFETCH_EVENTS = new Set([
  'order.created',
  'order.status_changed',
  'order.approval_requested',
  'order.approval_decided',
  'order.closed',
  'order_item.status_changed',
  'bill.requested',
  'invoice.paid',
])

/**
 * Compares labels the way staff read them: "T2" before "T10". Hand-rolled rather
 * than `localeCompare(…, { numeric: true })` because Hermes' Intl support varies
 * by platform and the ordering here has to be identical on every device.
 */
function naturalCompare(a: string, b: string): number {
  const as = a.match(/\d+|\D+/g) ?? []
  const bs = b.match(/\d+|\D+/g) ?? []
  for (let i = 0; i < Math.max(as.length, bs.length); i += 1) {
    const x = as[i]
    const y = bs[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (/^\d/.test(x) && /^\d/.test(y)) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y)
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/**
 * The floor grid: every active table, occupied or not, two to a row.
 *
 * Cards are sorted by table label and **never** reorder on occupancy — the grid
 * is positionally stable so staff can build muscle memory against the physical
 * floor plan. Read-only; no state transitions happen here.
 */
export function TablesScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetWaiterTablesQuery(undefined, {
    pollingInterval: 15_000,
  })

  // NOTE: this reuses the screen's single existing useStaffRealtime subscription.
  // Do not add another call site — each one opens its own WebSocket (known bug).
  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) refetch()
      },
      [refetch],
    ),
  )

  const tables = useMemo<WaiterTable[]>(
    () => [...(data ?? [])].sort((a, b) => naturalCompare(a.table_label, b.table_label)),
    [data],
  )

  const occupiedCount = useMemo(() => tables.filter((t) => t.occupied).length, [tables])

  return (
    <Screen>
      <FlatList
        data={tables}
        keyExtractor={(t) => t.table_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListHeaderComponent={
          tables.length > 0 ? (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Floor</Text>
              <View style={styles.flex} />
              <Text style={styles.headerCount}>
                {occupiedCount} of {tables.length} occupied
              </Text>
            </View>
          ) : null
        }
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
            emptyIcon="grid-outline"
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  row: { gap: spacing.md },
  // maxWidth keeps a lone card on an odd final row at half width instead of
  // stretching it across the whole grid.
  cell: { flex: 1, maxWidth: '50%' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: 13, color: colors.textMuted },
})
