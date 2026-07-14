/**
 * Android foreground service that keeps staff order-notifications flowing while
 * the app is backgrounded.
 *
 * Why this exists: order alerts ride a WebSocket and are posted by JS. When the
 * OS backgrounds/kills the app the JS stops and alerts go silent — and rugged
 * OEM skins (e.g. Blackview Doke OS) kill background apps aggressively. An
 * Android foreground service ties a long-running JS task to a persistent
 * notification the OS is very reluctant to kill, so the socket stays connected.
 *
 * Design:
 * - `registerBackgroundConnection()` runs once at startup (index.ts, top level)
 *   and registers the service runner with notifee.
 * - `startBackgroundConnection()` (on login) shows the ongoing notification,
 *   which starts the service and invokes the runner.
 * - `stopBackgroundConnection()` (on logout) tears the socket + service down.
 * - The runner refreshes the access token every ~4 min (tokens live 5 min) so a
 *   socket reconnect always has a valid token, opens the shared `ReconnectingWs`
 *   (which already has app-level heartbeat/reconnect), and posts a notification
 *   per relevant event — but only while the app is NOT foregrounded, so it and
 *   the in-app `useStaffAlerts` never double-fire.
 *
 * Android-only. In Expo Go (no native notifee) every entry point no-ops.
 */
import { AppState, Platform } from 'react-native'
import { notifee, AndroidImportance } from '@/lib/notifee'
import { ReconnectingWs } from '@/features/realtime/ws'
import { messageFor } from '@/lib/alertMessages'
import { api, setAccessToken } from '@/services/api'
import type { RealtimeEvent } from '@/types'

// The ongoing "service is running" notification lives on its own low-importance
// channel; the actual order alerts reuse the same high-importance channel id as
// the foreground in-app alerts so both look identical.
const SERVICE_CHANNEL = 'reva-service'
const ALERT_CHANNEL = 'staff-v2'

// Access tokens expire after 5 min (ACCESS_TOKEN_EXPIRE_MINUTES); refresh ahead
// of that so a WS reconnect never presents a stale token (which the server would
// reject with 1008, after which ReconnectingWs deliberately stops retrying).
const TOKEN_REFRESH_MS = 4 * 60_000

const isAndroid = Platform.OS === 'android'
const available = (): boolean => isAndroid && notifee !== null && AndroidImportance !== undefined

let ws: ReconnectingWs | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let stopRunner: (() => void) | null = null

async function ensureChannels(): Promise<void> {
  if (!notifee || !AndroidImportance) return
  await notifee.createChannel({
    id: SERVICE_CHANNEL,
    name: 'Reva connection',
    importance: AndroidImportance.LOW,
  })
  await notifee.createChannel({
    id: ALERT_CHANNEL,
    name: 'Staff alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  })
}

/** Refresh the in-memory access token from the persisted refresh cookie. */
async function refreshToken(): Promise<void> {
  try {
    const res = await api.post<{ access_token: string }>('/auth/refresh')
    setAccessToken(res.data.access_token)
  } catch {
    // No valid cookie / offline — next cycle retries; the socket stays down
    // until a token is available. Session teardown is handled by the app.
  }
}

/** Post an order alert, but only when backgrounded (foreground = useStaffAlerts). */
function postAlert(ev: RealtimeEvent): void {
  if (!notifee || !AndroidImportance) return
  if (AppState.currentState === 'active') return
  const msg = messageFor(ev)
  if (!msg) return
  void notifee
    .displayNotification({
      title: msg.title,
      body: msg.body,
      android: {
        channelId: ALERT_CHANNEL,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    })
    .catch(() => {
      /* ignore display failures */
    })
}

/** The long-running task body: token upkeep + socket + event → notification. */
async function runService(): Promise<void> {
  await ensureChannels()
  await refreshToken()

  ws = new ReconnectingWs({
    onMessage: (data) => {
      const ev = data as RealtimeEvent
      if (ev?.type) postAlert(ev)
    },
  })

  if (refreshTimer === null) {
    refreshTimer = setInterval(() => {
      void refreshToken()
    }, TOKEN_REFRESH_MS)
  }
}

/**
 * Register the service runner. MUST be called at module load (index.ts), before
 * any `startBackgroundConnection()`, and outside any React component.
 */
export function registerBackgroundConnection(): void {
  if (!available() || !notifee) return
  notifee.registerForegroundService(() => {
    // The returned promise stays pending for the service's lifetime; it resolves
    // only when stopBackgroundConnection() calls stopForegroundService().
    return new Promise<void>((resolve) => {
      stopRunner = resolve
      void runService()
    })
  })
}

/** Show the ongoing notification, which starts the foreground service. */
export async function startBackgroundConnection(): Promise<void> {
  if (!available() || !notifee || !AndroidImportance) return
  await ensureChannels()
  await notifee.displayNotification({
    title: 'Reva',
    body: 'Connected — you’ll be alerted to new orders.',
    android: {
      channelId: SERVICE_CHANNEL,
      asForegroundService: true,
      ongoing: true,
      importance: AndroidImportance.LOW,
      pressAction: { id: 'default' },
    },
  })
}

/** Tear down the socket, token timer, and foreground service. */
export async function stopBackgroundConnection(): Promise<void> {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  ws?.destroy()
  ws = null
  if (available() && notifee) {
    try {
      await notifee.stopForegroundService()
    } catch {
      /* service may already be stopped */
    }
  }
  stopRunner?.()
  stopRunner = null
}
