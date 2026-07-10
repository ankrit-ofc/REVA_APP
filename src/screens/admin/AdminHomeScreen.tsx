import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useAuth } from '@/features/auth/useAuth'
import type { AdminScreenProps, AdminStackParamList } from '@/navigation/types'
import { colors, spacing } from '@/theme'

const LINKS: { label: string; screen: keyof AdminStackParamList }[] = [
  { label: 'Categories', screen: 'Categories' },
  { label: 'Products', screen: 'Products' },
  { label: 'Add-ons', screen: 'Addons' },
  { label: 'Staff', screen: 'Staff' },
  { label: 'Tables', screen: 'Tables' },
  { label: 'Settings', screen: 'Settings' },
]

export function AdminHomeScreen({ navigation }: AdminScreenProps<'AdminHome'>) {
  const { restaurantId } = useAuth()
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.subtitle}>Restaurant {restaurantId ? restaurantId.slice(0, 8) : ''}</Text>
        {LINKS.map((l) => (
          <View key={l.screen} style={styles.item}>
            <Button title={l.label} variant="secondary" onPress={() => navigation.navigate(l.screen)} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xl },
  item: { marginBottom: spacing.md },
})
