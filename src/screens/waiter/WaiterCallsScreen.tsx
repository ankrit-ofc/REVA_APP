import { useCallback } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { QueryState } from '@/components/QueryState'
import {
  useGetWaiterCallsQuery,
  useAttendWaiterCallMutation,
} from '@/features/waiter/waiterApi'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
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

/**
 * Open 'Call Waiter' requests. Each call is persisted server-side; tapping
 * "Attended" confirms a waiter reached the table and clears it on every dashboard.
 */
export function WaiterCallsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useGetWaiterCallsQuery(undefined, {
    pollingInterval: 15_000,
  })
  const [attend, { isLoading: busy }] = useAttendWaiterCallMutation()

  useStaffRealtime(
    useCallback(
      (ev) => {
        if (ev.type === 'waiter.called' || ev.type === 'waiter.call_attended') refetch()
      },
      [refetch],
    ),
  )

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowTop}>
              <Ionicons name="notifications-outline" size={18} color={colors.warning} style={styles.icon} />
              <Text style={styles.table}>Table {item.table_name}</Text>
              <View style={styles.flex} />
              <Text style={styles.waited}>waiting {waitedFor(item.created_at)}</Text>
            </View>
            <Text style={styles.hint}>Guest requested a waiter.</Text>
            <View style={{ height: spacing.sm }} />
            <Button
              title="Attended"
              variant="success"
              disabled={busy}
              onPress={() => attend(item.id)}
            />
          </Card>
        )}
        ListEmptyComponent={
          <QueryState
            loading={isLoading}
            error={isError}
            empty={!isLoading && !isError}
            emptyText="No tables are waiting."
            emptyIcon="notifications-off-outline"
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
  icon: { marginRight: spacing.xs },
  table: { fontSize: 17, fontWeight: '800', color: colors.text },
  waited: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted },
})
