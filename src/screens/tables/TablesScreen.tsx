import { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { QueryState } from '@/components/QueryState'
import { useGetActiveTablesQuery } from '@/features/dashboard/dashboardApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import { formatMoney } from '@/lib/money'
import type { ActiveTable } from '@/lib/schemas/dashboard'
import { colors, spacing } from '@/theme'

/** Short "waiting for" label from an ISO timestamp (e.g. "just now", "3m", "1h 5m"). */
function waitedFor(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

// The active-tables set changes when orders open/close, get approved, or their
// items move — the same events the Orders screen refetches on.
const REFETCH_EVENTS = new Set([
  'order.created',
  'order.status_changed',
  'order.approval_requested',
  'order.approval_decided',
  'order_item.status_changed',
  'bill.requested',
])

/**
 * Floor overview: every table with an active (OPEN) order, longest-waiting
 * first, mirroring the web admin's "Active Tables" widget. Tap a table to
 * expand its orders and the items on each. Read-only — no state transitions.
 */
export function TablesScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetActiveTablesQuery(undefined, {
    pollingInterval: 15_000,
  })

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = useCallback((tableId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(tableId)) next.delete(tableId)
      else next.add(tableId)
      return next
    })
  }, [])

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (REFETCH_EVENTS.has(ev.type)) refetch()
      },
      [refetch],
    ),
  )

  // Backend already sorts longest-waiting first; re-sort defensively so the
  // order is guaranteed regardless of transport.
  const tables = useMemo<ActiveTable[]>(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(a.earliest_placed_at).getTime() - new Date(b.earliest_placed_at).getTime(),
      ),
    [data],
  )

  return (
    <Screen>
      <FlatList
        data={tables}
        keyExtractor={(t) => t.table_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => {
          const isOpen = expanded.has(item.table_id)
          return (
            <Card>
              <Pressable onPress={() => toggle(item.table_id)}>
                <View style={styles.rowTop}>
                  <Ionicons name="restaurant-outline" size={16} color={colors.primary} style={styles.icon} />
                  <Text style={styles.table}>{item.table_label}</Text>
                  <View style={styles.flex} />
                  <Text style={styles.waited}>{waitedFor(item.earliest_placed_at)}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                    style={styles.chevron}
                  />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {item.order_count} order{item.order_count !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.total}>{formatMoney(item.total_amount)}</Text>
                </View>
              </Pressable>

              {isOpen ? (
                <View style={styles.details}>
                  {item.orders.map((o) => (
                    <View key={o.order_id} style={styles.order}>
                      <Text style={styles.orderNo}>#{o.order_number}</Text>
                      {o.items.length === 0 ? (
                        <Text style={styles.muted}>No items.</Text>
                      ) : (
                        o.items.map((it, idx) => (
                          <Text key={`${o.order_id}-${idx}`} style={styles.product}>
                            {it.quantity}× {it.name}
                          </Text>
                        ))
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          )
        }}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No occupied tables."
            emptyIcon="restaurant-outline"
          />
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  icon: { marginRight: spacing.xs },
  chevron: { marginLeft: spacing.sm },
  table: { fontSize: 16, fontWeight: '800', color: colors.text },
  waited: { fontSize: 13, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  meta: { fontSize: 13, color: colors.textMuted },
  dot: { fontSize: 13, color: colors.textMuted, marginHorizontal: spacing.xs },
  total: { fontSize: 13, fontWeight: '700', color: colors.primary },
  details: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  order: { marginBottom: spacing.sm },
  orderNo: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 2 },
  product: { fontSize: 14, color: colors.text, marginBottom: 2 },
  muted: { fontSize: 13, color: colors.textMuted },
})
