import { StyleSheet, Text, View } from 'react-native'
import { Card } from '@/components/Card'
import type { WaiterTable } from '@/lib/schemas/dashboard'
import { colors, spacing } from '@/theme'

/** How many merged item lines fit on a card before we collapse to "+N more". */
const MAX_ITEM_LINES = 3

/**
 * One tile in the floor grid. State is carried by colour **and** text — red and
 * green are the common colour-blind pair, so the dot is always paired with the
 * word "Occupied" / "Available" rather than standing on its own.
 */
export function TableCard({ table }: { table: WaiterTable }) {
  const state = table.occupied ? 'Occupied' : 'Available'
  const shown = table.items.slice(0, MAX_ITEM_LINES)
  const hidden = table.items.length - shown.length

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`Table ${table.table_label}, ${state}`}
        accessibilityRole="summary"
      >
        <Text style={styles.label} numberOfLines={1}>
          {table.table_label}
        </Text>

        <View style={styles.stateRow}>
          <View
            style={[styles.dot, { backgroundColor: table.occupied ? colors.danger : colors.success }]}
          />
          <Text style={[styles.state, table.occupied ? styles.occupied : styles.available]}>
            {state}
          </Text>
        </View>

        <View style={styles.body}>
          {table.occupied ? (
            <>
              {shown.map((it, idx) => (
                <Text key={`${table.table_id}-${idx}`} style={styles.item} numberOfLines={1}>
                  {it.quantity}× {it.name}
                </Text>
              ))}
              {hidden > 0 ? <Text style={styles.more}>+{hidden} more</Text> : null}
            </>
          ) : (
            <Text style={styles.muted}>No active order</Text>
          )}
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '800', color: colors.text },
  stateRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  state: { fontSize: 13, fontWeight: '700' },
  occupied: { color: colors.danger },
  available: { color: colors.success },
  body: { marginTop: spacing.sm },
  item: { fontSize: 13, color: colors.text, marginBottom: 2 },
  more: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, color: colors.textMuted },
})
