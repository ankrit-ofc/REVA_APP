import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuthBootstrap } from '@/bootstrap/useAuthBootstrap'
import { useAuth } from '@/features/auth/useAuth'
import { AuthNavigator } from './AuthNavigator'
import { AppNavigator } from './AppNavigator'
import { colors } from '@/theme'

export function RootNavigator() {
  const ready = useAuthBootstrap()
  const { isAuthenticated } = useAuth()

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
})
