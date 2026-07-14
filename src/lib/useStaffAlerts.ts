import { useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import { Notifications } from '@/lib/notifications'
import { messageFor } from '@/lib/alertMessages'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import type { RealtimeEvent } from '@/types'

const PREF_KEY = 'staff_alerts_enabled'

// Android channel settings are immutable after first creation, so shipping new
// settings (importance, lock-screen visibility) requires a new channel id.
const CHANNEL_ID = 'staff-v2'

// Show a local notification even while the app is foregrounded. Skipped in Expo
// Go, where the notifications module is unavailable (see @/lib/notifications).
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Mounts once inside the authenticated area. Presents a local notification
 * (with sound) for the events relevant to staff, gated by a persisted
 * preference. This is the React Native replacement for the web app's Web Audio
 * chime + browser Notification API.
 *
 * Posts only while the app is FOREGROUNDED. When backgrounded, the notifee
 * foreground service (see features/background) is the notifier — the AppState
 * check keeps the two from double-firing for the same event.
 */
export function useStaffAlerts(): void {
  const enabledRef = useRef(true)

  useEffect(() => {
    if (!Notifications) return // Expo Go — notifications unavailable
    let active = true
    ;(async () => {
      try {
        const perm = await Notifications.getPermissionsAsync()
        if (!perm.granted) await Notifications.requestPermissionsAsync()
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Staff alerts',
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
          })
        }
        const stored = await AsyncStorage.getItem(PREF_KEY)
        if (active && stored != null) enabledRef.current = stored === 'true'
      } catch {
        // notifications unavailable — alerts silently disabled
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useStaffRealtime(
    useCallback((ev: RealtimeEvent) => {
      if (!Notifications || !enabledRef.current) return
      // Background delivery is owned by the foreground service; only post here
      // when the app is actually in front, to avoid duplicate notifications.
      if (AppState.currentState !== 'active') return
      const msg = messageFor(ev)
      if (!msg) return
      Notifications.scheduleNotificationAsync({
        content: { title: msg.title, body: msg.body },
        // trigger: null would post to the default "Miscellaneous" channel;
        // a channel-only trigger fires immediately on the staff channel.
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      }).catch(() => {
        /* ignore scheduling failures */
      })
    }, []),
  )
}
