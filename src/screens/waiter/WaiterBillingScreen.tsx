import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { BillingView } from '@/screens/billing/BillingView'
import { QueryState } from '@/components/QueryState'
import { useGetBillingEnabledQuery } from '@/features/waiter/waiterApi'
import { useAuth } from '@/features/auth/useAuth'
import { colors, spacing } from '@/theme'

/**
 * Waiter billing is only available when the restaurant enables
 * `waiter_can_accept_payment`. The backend enforces this; this screen just
 * reflects it (a hidden button is never authorization).
 */
export function WaiterBillingScreen() {
  const { role } = useAuth()
  const { data, isLoading, isError } = useGetBillingEnabledQuery()

  if (isLoading || isError) {
    return (
      <Screen>
        <QueryState loading={isLoading} error={isError} empty={false} />
      </Screen>
    )
  }

  if (!data?.enabled) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Billing not enabled</Text>
          <Text style={styles.muted}>
            Waiter payments are turned off for this restaurant. Ask an admin to enable
            “waiter can accept payment,” or send tables to the counter.
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <BillingView role={role} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
})
