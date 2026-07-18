import { Pressable, StyleSheet, Text } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Ionicons } from '@expo/vector-icons'
import { realtimeRetry } from '@/features/ui/uiSlice'
import type { AppDispatch, RootState } from '@/store/store'
import { colors } from '@/theme'

/**
 * Shown when the staff WebSocket has given up reconnecting (the server refused
 * our credentials twice — see ws.ts). Tapping bumps the retry nonce, which
 * recreates every realtime socket with a freshly minted ticket. Without this
 * banner a rejected connection would be indistinguishable from a quiet shift.
 */
export function RealtimeBanner() {
  const down = useSelector((s: RootState) => s.ui.realtimeDown)
  const dispatch = useDispatch<AppDispatch>()

  if (!down) return null
  return (
    <Pressable
      style={styles.banner}
      onPress={() => dispatch(realtimeRetry())}
      accessibilityRole="button"
      accessibilityLabel="Live notifications disconnected. Tap to retry."
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.primaryText} />
      <Text style={styles.text}>Live notifications disconnected — tap to retry</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
})
