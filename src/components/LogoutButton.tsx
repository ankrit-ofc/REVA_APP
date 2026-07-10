import { Pressable, StyleSheet, Text } from 'react-native'
import { useAuth } from '@/features/auth/useAuth'
import { colors } from '@/theme'

/** Header-right sign-out control. */
export function LogoutButton() {
  const { logout, isLoggingOut } = useAuth()
  return (
    <Pressable onPress={() => logout()} disabled={isLoggingOut} hitSlop={8}>
      <Text style={styles.text}>{isLoggingOut ? '…' : 'Sign out'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  text: { color: colors.primary, fontWeight: '600', fontSize: 14, paddingHorizontal: 8 },
})
