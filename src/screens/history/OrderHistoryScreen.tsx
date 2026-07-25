import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { QueryState } from '@/components/QueryState'
import { ReceiptModal } from '@/screens/billing/BillingView'
import { useLazyGetOrderHistoryQuery } from '@/features/counter/counterApi'
import type { OrderHistoryRow, OrderHistoryStatus } from '@/lib/schemas/history'
import { colors, spacing } from '@/theme'

const PAGE = 50

/** "Jul 25, 2:04 PM"-style stamp from an ISO timestamp. */
function formatWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// PAID is a sale (accent); REFUNDED / VOID are not revenue (muted).
const STATUS_COLOR: Record<OrderHistoryStatus, string> = {
  PAID: colors.success,
  REFUNDED: colors.textMuted,
  VOID: colors.textMuted,
}

/**
 * Past billed orders (PAID / REFUNDED / VOID), newest-first, paginated. Tapping
 * a row opens the shared ReceiptModal (variant="history") for its invoice.
 * Rows are keyed on invoice_id — order_number is NOT unique across re-invoices.
 */
export function OrderHistoryScreen() {
  const [trigger] = useLazyGetOrderHistoryQuery()

  const [rows, setRows] = useState<OrderHistoryRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  // Guards against overlapping page loads (onEndReached can fire repeatedly).
  const inFlight = useRef(false)

  const fetchPage = useCallback(
    async (mode: 'initial' | 'more' | 'refresh') => {
      if (inFlight.current) return
      const offset = mode === 'more' ? rows.length : 0
      // Nothing more to page once we've reached the filtered total.
      if (mode === 'more' && total !== null && rows.length >= total) return
      inFlight.current = true
      if (mode === 'refresh') setRefreshing(true)
      else setStatus('loading')
      try {
        const res = await trigger({ limit: PAGE, offset }).unwrap()
        setTotal(res.total)
        setRows((prev) => (mode === 'more' ? [...prev, ...res.items] : res.items))
        setStatus('idle')
      } catch {
        setStatus('error')
      } finally {
        inFlight.current = false
        if (mode === 'refresh') setRefreshing(false)
      }
    },
    [rows.length, total, trigger],
  )

  useEffect(() => {
    fetchPage('initial')
    // Load once on mount; paging/refresh are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadingMore = status === 'loading' && rows.length > 0

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.invoice_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPage('refresh')} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => fetchPage('more')}
        renderItem={({ item }) => (
          <Pressable onPress={() => setReceiptId(item.invoice_id)}>
            <Card>
              <View style={styles.rowTop}>
                <Text style={styles.orderNo}>#{item.order_number}</Text>
                <Text style={styles.table}>{item.table_name}</Text>
                <View style={styles.flex} />
                <Text style={styles.total}>
                  {item.currency} {item.total}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>
                  {item.status}
                </Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.when}>{formatWhen(item.created_at)}</Text>
                <View style={styles.flex} />
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <QueryState
            loading={status === 'loading'}
            error={status === 'error'}
            empty={status === 'idle'}
            emptyText="No past orders yet."
            emptyIcon="time-outline"
          />
        }
      />
      <ReceiptModal
        invoiceId={receiptId}
        onClose={() => setReceiptId(null)}
        variant="history"
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  flex: { flex: 1 },
  orderNo: { fontSize: 15, fontWeight: '800', color: colors.text, marginRight: spacing.sm },
  table: { fontSize: 14, color: colors.text },
  total: { fontSize: 15, fontWeight: '800', color: colors.text },
  status: { fontSize: 13, fontWeight: '700' },
  dot: { fontSize: 13, color: colors.textMuted, marginHorizontal: spacing.xs },
  when: { fontSize: 13, color: colors.textMuted },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
})
