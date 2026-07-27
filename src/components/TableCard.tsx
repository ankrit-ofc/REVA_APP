import { StyleSheet, Text, View } from 'react-native'
import type { WaiterTable } from '@/lib/schemas/dashboard'
import { colors, radius, spacing } from '@/theme'

const MIN_HEIGHT = 148

type Props = {
  table: WaiterTable
}

/**
 * Floor-map cell matching the staff tables mock:
 * [dot + label] …… [Occupied|Available], then up to 3 items or “No active order”.
 * Occupied = red, Available = green (mock had colours inverted).
 */
export function TableCard({ table }: Props) {
  const preview = table.items.slice(0, 3)
  const more = table.items.length - preview.length
  const occupied = table.occupied

  return (
    <View style={[styles.card, occupied ? styles.cardOccupied : styles.cardFree]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={[styles.dot, { backgroundColor: occupied ? colors.danger : colors.success }]}
            accessibilityLabel={occupied ? 'Occupied' : 'Available'}
          />
          <Text style={styles.label} numberOfLines={1}>
            {table.table_label}
          </Text>
        </View>
        <Text style={[styles.statusText, occupied ? styles.statusOccupied : styles.statusFree]}>
          {occupied ? 'Occupied' : 'Available'}
        </Text>
      </View>

      {occupied ? (
        <View style={styles.items}>
          {preview.length === 0 ? (
            <Text style={styles.muted}>No items yet</Text>
          ) : (
            preview.map((it, idx) => (
              <Text key={`${table.table_id}-${idx}`} style={styles.item} numberOfLines={1}>
                {it.quantity}x {it.name}
              </Text>
            ))
          )}
          {more > 0 ? <Text style={styles.more}>+{more} more</Text> : null}
        </View>
      ) : (
        <Text style={styles.available}>No active order</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: MIN_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardOccupied: {
    borderColor: colors.danger + '55',
  },
  cardFree: {
    borderColor: colors.success + '44',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusOccupied: { color: colors.danger },
  statusFree: { color: colors.success },
  items: {
    gap: 2,
  },
  item: {
    fontSize: 13,
    color: colors.text,
  },
  more: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  available: {
    fontSize: 13,
    color: colors.textMuted,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
})
