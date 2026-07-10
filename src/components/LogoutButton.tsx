import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/features/auth/useAuth'
import { colors } from '@/theme'

/** Header-right sign-out control. */
export function LogoutButton() {
  const { logout, isLoggingOut } = useAuth()
  return (
    <Pressable onPress={() => logout()} disabled={isLoggingOut} hitSlop={8} style={styles.row}>
      <Ionicons name="log-out-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>{isLoggingOut ? '…' : 'Sign out'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  text: { color: colors.primary, fontWeight: '600', fontSize: 14, marginLeft: 4 },
})
