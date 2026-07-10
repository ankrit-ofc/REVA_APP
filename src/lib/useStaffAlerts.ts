import { useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { Notifications } from '@/lib/notifications'
import { useStaffRealtime } from '@/features/realtime/useRealtime'
import type { RealtimeEvent } from '@/types'

const PREF_KEY = 'staff_alerts_enabled'

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

/** Human-readable alert copy per event type, or null to ignore the event. */
function messageFor(ev: RealtimeEvent): { title: string; body: string } | null {
  switch (ev.type) {
    case 'waiter.called':
      return { title: 'Waiter called', body: `Table needs a waiter.` }
    case 'order.created':
      return { title: 'New order', body: `A new order came in.` }
    case 'order.approval_requested':
      return { title: 'Approval needed', body: `A batch is waiting for your approval.` }
    case 'bill.requested':
      return { title: 'Bill requested', body: `A table asked for the bill.` }
    case 'order_item.status_changed':
      return ev['status'] === 'READY'
        ? { title: 'Item ready', body: `An item is ready to serve.` }
        : null
    default:
      return null
  }
}

/**
 * Mounts once inside the authenticated area. Presents a local notification
 * (with sound) for the events relevant to staff, gated by a persisted
 * preference. This is the React Native replacement for the web app's Web Audio
 * chime + browser Notification API.
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
          await Notifications.setNotificationChannelAsync('staff', {
            name: 'Staff alerts',
            importance: Notifications.AndroidImportance.HIGH,
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
      const msg = messageFor(ev)
      if (!msg) return
      Notifications.scheduleNotificationAsync({
        content: { title: msg.title, body: msg.body },
        trigger: null,
      }).catch(() => {
        /* ignore scheduling failures */
      })
    }, []),
  )
}
