import { useCallback, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { Notifications } from '@/lib/notifications'
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

/** Read a string field off an event, or undefined when absent/non-string. */
function str(ev: RealtimeEvent, key: string): string | undefined {
  const v = ev[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** `Table 12` / `Table 12 (order #7)` / a fallback when the table is unknown. */
function tableLabel(ev: RealtimeEvent, fallback: string): string {
  const table = str(ev, 'table_name')
  return table ? `Table ${table}` : fallback
}

/** ` (order #7)` when the event carries an order number, else ''. */
function orderSuffix(ev: RealtimeEvent): string {
  const n = ev['order_number']
  return typeof n === 'number' || typeof n === 'string' ? ` (order #${n})` : ''
}

/** Human-readable alert copy per event type, or null to ignore the event. */
function messageFor(ev: RealtimeEvent): { title: string; body: string } | null {
  switch (ev.type) {
    case 'waiter.called':
      return { title: 'Waiter called', body: `${tableLabel(ev, 'A table')} needs a waiter.` }
    case 'order.created':
      return { title: 'New order', body: `${tableLabel(ev, 'A table')} placed an order${orderSuffix(ev)}.` }
    case 'order.approval_requested':
      return {
        title: 'Approval needed',
        body: `${tableLabel(ev, 'A table')} placed an order${orderSuffix(ev)} — approve or reject it.`,
      }
    case 'bill.requested':
      return { title: 'Bill requested', body: `${tableLabel(ev, 'A table')} asked for the bill${orderSuffix(ev)}.` }
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
