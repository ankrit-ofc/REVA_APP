import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '@/theme'

interface Props {
  loading: boolean
  error: boolean
  empty: boolean
  emptyText?: string
}

/**
 * Renders a centered loading / error / empty placeholder. Returns null when
 * there is data to show (`loading` false, `error` false, `empty` false).
 */
export function QueryState({ loading, error, empty, emptyText = 'Nothing here yet.' }: Props) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Couldn’t load. Pull to retry.</Text>
      </View>
    )
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{emptyText}</Text>
      </View>
    )
  }
  return null
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.danger, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 14 },
})
