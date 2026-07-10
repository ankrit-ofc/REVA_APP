import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '@/theme'

type IoniconName = keyof typeof Ionicons.glyphMap

interface Props {
  loading: boolean
  error: boolean
  empty: boolean
  emptyText?: string
  emptyIcon?: IoniconName
}

/**
 * Renders a centered loading / error / empty placeholder. Returns null when
 * there is data to show (`loading` false, `error` false, `empty` false).
 */
export function QueryState({
  loading,
  error,
  empty,
  emptyText = 'Nothing here yet.',
  emptyIcon = 'file-tray-outline',
}: Props) {
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
        <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
        <Text style={styles.error}>Couldn’t load. Pull to retry.</Text>
      </View>
    )
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name={emptyIcon} size={34} color={colors.primary} />
        </View>
        <Text style={styles.muted}>{emptyText}</Text>
      </View>
    )
  }
  return null
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
  muted: { color: colors.textMuted, fontSize: 14 },
})
