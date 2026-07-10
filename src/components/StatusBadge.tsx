import { StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '@/theme'

/** Colored pill for an order-item status. */
export function StatusBadge({ status }: { status: string }) {
  const color = colors.status[status] ?? colors.textMuted
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
})
