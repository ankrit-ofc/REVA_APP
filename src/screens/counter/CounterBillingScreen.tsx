import { Screen } from '@/components/Screen'
import { BillingView } from '@/screens/billing/BillingView'
import { useAuth } from '@/features/auth/useAuth'

export function CounterBillingScreen() {
  const { role } = useAuth()
  return (
    <Screen>
      <BillingView role={role} />
    </Screen>
  )
}
