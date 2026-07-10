import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { LogoutButton } from '@/components/LogoutButton'
import { useAuth } from '@/features/auth/useAuth'
import { useStaffAlerts } from '@/lib/useStaffAlerts'
import type { AdminStackParamList } from './types'
import { colors } from '@/theme'

type IoniconName = keyof typeof Ionicons.glyphMap

/** Builds a tabBarIcon render fn for a given Ionicons glyph. */
function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  )
}

import { KitchenScreen } from '@/screens/kitchen/KitchenScreen'
import { WaiterReadyScreen } from '@/screens/waiter/WaiterReadyScreen'
import { WaiterOrdersScreen } from '@/screens/waiter/WaiterOrdersScreen'
import { WaiterBillingScreen } from '@/screens/waiter/WaiterBillingScreen'
import { CounterBillingScreen } from '@/screens/counter/CounterBillingScreen'
import { CounterDisplayScreen } from '@/screens/counter/CounterDisplayScreen'
import { AdminHomeScreen } from '@/screens/admin/AdminHomeScreen'
import { CategoriesScreen } from '@/screens/admin/CategoriesScreen'
import { ProductsScreen } from '@/screens/admin/ProductsScreen'
import { AddonsScreen } from '@/screens/admin/AddonsScreen'
import { StaffScreen } from '@/screens/admin/StaffScreen'
import { TablesScreen } from '@/screens/admin/TablesScreen'
import { SettingsScreen } from '@/screens/admin/SettingsScreen'
import { RestaurantsScreen } from '@/screens/superadmin/RestaurantsScreen'

const headerRight = () => <LogoutButton />

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text },
  headerTintColor: colors.primary,
  headerRight,
} as const

const tabOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text },
  headerRight,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
} as const

// ── Kitchen ───────────────────────────────────────────────────────────────────
const KitchenStack = createNativeStackNavigator()
function KitchenNavigator() {
  return (
    <KitchenStack.Navigator screenOptions={screenOptions}>
      <KitchenStack.Screen name="Kitchen" component={KitchenScreen} options={{ title: 'Kitchen' }} />
    </KitchenStack.Navigator>
  )
}

// ── Waiter (tabs) ───────────────────────────────────────────────────────────────
const WaiterTabs = createBottomTabNavigator()
function WaiterNavigator() {
  return (
    <WaiterTabs.Navigator screenOptions={tabOptions}>
      <WaiterTabs.Screen
        name="Serve"
        component={WaiterReadyScreen}
        options={{ title: 'Serve', tabBarIcon: tabIcon('checkmark-done-outline') }}
      />
      <WaiterTabs.Screen
        name="Orders"
        component={WaiterOrdersScreen}
        options={{ title: 'Orders', tabBarIcon: tabIcon('receipt-outline') }}
      />
      <WaiterTabs.Screen
        name="WaiterBilling"
        component={WaiterBillingScreen}
        options={{ title: 'Billing', tabBarIcon: tabIcon('card-outline') }}
      />
    </WaiterTabs.Navigator>
  )
}

// ── Counter (tabs) ──────────────────────────────────────────────────────────────
const CounterTabs = createBottomTabNavigator()
function CounterNavigator() {
  return (
    <CounterTabs.Navigator screenOptions={tabOptions}>
      <CounterTabs.Screen
        name="Billing"
        component={CounterBillingScreen}
        options={{ title: 'Billing', tabBarIcon: tabIcon('card-outline') }}
      />
      <CounterTabs.Screen
        name="Display"
        component={CounterDisplayScreen}
        options={{ title: 'Display', tabBarIcon: tabIcon('tv-outline') }}
      />
    </CounterTabs.Navigator>
  )
}

// ── Counter display only ────────────────────────────────────────────────────────
const DisplayStack = createNativeStackNavigator()
function DisplayNavigator() {
  return (
    <DisplayStack.Navigator screenOptions={screenOptions}>
      <DisplayStack.Screen name="Display" component={CounterDisplayScreen} options={{ title: 'Counter Display' }} />
    </DisplayStack.Navigator>
  )
}

// ── Admin (stack) ───────────────────────────────────────────────────────────────
const AdminStack = createNativeStackNavigator<AdminStackParamList>()
function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={screenOptions}>
      <AdminStack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
      <AdminStack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <AdminStack.Screen name="Products" component={ProductsScreen} options={{ title: 'Products' }} />
      <AdminStack.Screen name="Addons" component={AddonsScreen} options={{ title: 'Add-ons' }} />
      <AdminStack.Screen name="Staff" component={StaffScreen} options={{ title: 'Staff' }} />
      <AdminStack.Screen name="Tables" component={TablesScreen} options={{ title: 'Tables' }} />
      <AdminStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </AdminStack.Navigator>
  )
}

// ── Superadmin ──────────────────────────────────────────────────────────────────
const SuperadminStack = createNativeStackNavigator()
function SuperadminNavigator() {
  return (
    <SuperadminStack.Navigator screenOptions={screenOptions}>
      <SuperadminStack.Screen name="Restaurants" component={RestaurantsScreen} options={{ title: 'Restaurants' }} />
    </SuperadminStack.Navigator>
  )
}

/**
 * Authenticated app: the role from the JWT decides which surface to show — the
 * same mapping the web app uses post-login. Staff alerts are mounted once here.
 */
export function AppNavigator() {
  const { role } = useAuth()
  useStaffAlerts()

  switch (role) {
    case 'SUPERADMIN':
      return <SuperadminNavigator />
    case 'ADMIN':
      return <AdminNavigator />
    case 'KITCHEN':
      return <KitchenNavigator />
    case 'WAITER':
      return <WaiterNavigator />
    case 'COUNTER_DISPLAY':
      return <DisplayNavigator />
    case 'COUNTER':
    default:
      return <CounterNavigator />
  }
}
