/**
 * Expo push-notification registration.
 *
 * Delivers staff alerts (new order, waiter called, bill requested) even when the
 * app is backgrounded or fully closed — which a WebSocket cannot, once the OS
 * kills the process. Expo Push relays to FCM (Android) / APNs (iOS).
 *
 * Flow: after login the app requests permission, obtains its Expo push token,
 * and registers it with the backend (POST /push/register). On logout it
 * deactivates the token (POST /push/unregister) so a shared device stops
 * receiving the previous user's alerts.
 *
 * No-op in Expo Go (native notifications unavailable) and if no projectId is
 * configured (run `eas init`), so the app never crashes when push isn't set up.
 */
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { Notifications } from '@/lib/notifications'
import { api } from '@/services/api'

// Must match the channelId the backend sends (push_service._ANDROID_CHANNEL) so
// high-priority, lock-screen, sounded delivery applies to the pushed alerts.
export const PUSH_CHANNEL_ID = 'staff-orders'

let registeredToken: string | null = null

/** Resolve the EAS project id needed by getExpoPushTokenAsync (set by `eas init`). */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId
}

/** Create the Android channel the pushed alerts target (heads-up + lock screen). */
async function ensureChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Order alerts',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    vibrationPattern: [300, 500],
    enableVibrate: true,
  })
}

/**
 * Register this device's Expo push token with the backend. Best-effort: any
 * failure (permission denied, Expo Go, no projectId, network) is swallowed so
 * login is never blocked.
 */
export async function registerForPush(): Promise<void> {
  if (!Notifications) return
  try {
    await ensureChannel()

    const perm = await Notifications.getPermissionsAsync()
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync()
      if (!req.granted) return
    }

    const pid = projectId()
    if (!pid) return // `eas init` not run yet — can't mint a token

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid })
    if (!token) return

    await api.post('/push/register', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    })
    registeredToken = token
  } catch {
    // Push simply stays off for this device; in-app WS alerts still work.
  }
}

/** Deactivate this device's token on logout. Best-effort; ignores failures. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return
  const token = registeredToken
  registeredToken = null
  try {
    await api.post('/push/unregister', { token })
  } catch {
    // Already logging out; a stale token is reassigned on the next login anyway.
  }
}
