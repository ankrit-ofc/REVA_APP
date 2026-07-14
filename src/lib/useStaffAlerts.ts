import { useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import { Notifications } from '@/lib/notifications'
import { messageFor } from '@/lib/alertMessages'
import { registerForPush } from '@/features/push/push'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import type { RealtimeEvent } from '@/types'

const PREF_KEY = 'staff_alerts_enabled'

// Android channel settings are immutable after first creation, so shipping new
// settings (importance, lock-screen visibility) requires a new channel id.
const CHANNEL_ID = 'staff-v2'

// Foreground display handler. A remote PUSH arriving while the app is in front is
// a duplicate of the in-app WS alert below, so it's suppressed here; local
// (scheduled) alerts still show. In the background/closed the OS shows the push
// directly (this handler doesn't run then). Skipped in Expo Go.
Notifications?.setNotificationHandler({
  handleNotification: async (notification) => {
    const isPush =
      (notification.request.trigger as { type?: string } | null)?.type === 'push'
    const show = !isPush
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    }
  },
})

/**
 * Mounts once inside the authenticated area. Presents a local notification
 * (with sound) for the events relevant to staff, gated by a persisted
 * preference. This is the React Native replacement for the web app's Web Audio
 * chime + browser Notification API.
 *
 * Posts only while the app is FOREGROUNDED. When backgrounded or closed, push
 * notifications (registered here via registerForPush) are the notifier — the
 * AppState check keeps the two from double-firing for the same event.
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
      // Register this device for push so alerts arrive when the app is closed.
      await registerForPush()
    })()
    return () => {
      active = false
    }
  }, [])

  useStaffRealtime(
    useCallback((ev: RealtimeEvent) => {
      if (!Notifications || !enabledRef.current) return
      // Background/closed delivery is owned by push; only post the WS alert when
      // the app is actually in front, to avoid duplicate notifications.
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
