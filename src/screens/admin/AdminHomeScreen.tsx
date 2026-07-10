import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/features/auth/useAuth'
import type { AdminScreenProps, AdminStackParamList } from '@/navigation/types'
import { colors, radius, shadow, spacing } from '@/theme'

type IoniconName = keyof typeof Ionicons.glyphMap

const LINKS: {
  label: string
  screen: keyof AdminStackParamList
  icon: IoniconName
  hint: string
}[] = [
  { label: 'Categories', screen: 'Categories', icon: 'pricetags-outline', hint: 'Menu sections' },
  { label: 'Products', screen: 'Products', icon: 'fast-food-outline', hint: 'Dishes & drinks' },
  { label: 'Add-ons', screen: 'Addons', icon: 'add-circle-outline', hint: 'Extras & options' },
  { label: 'Staff', screen: 'Staff', icon: 'people-outline', hint: 'Team accounts' },
  { label: 'Tables', screen: 'Tables', icon: 'grid-outline', hint: 'Floor & seating' },
  { label: 'Settings', screen: 'Settings', icon: 'settings-outline', hint: 'Restaurant setup' },
]

export function AdminHomeScreen({ navigation }: AdminScreenProps<'AdminHome'>) {
  const { restaurantId } = useAuth()
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.subtitle}>
          Restaurant {restaurantId ? restaurantId.slice(0, 8) : ''}
        </Text>

        <View style={styles.list}>
          {LINKS.map((l) => (
            <Pressable
              key={l.screen}
              onPress={() => navigation.navigate(l.screen)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={l.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{l.label}</Text>
                <Text style={styles.rowHint}>{l.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xl },
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
})
