/**
 * Authenticated staff WebSocket client with exponential-backoff reconnection.
 * React Native provides a global `WebSocket`, so this is nearly identical to the
 * web client; only the base URL source differs (build-time env, not window.location).
 *
 * Security invariants:
 * - The token is always read from the in-memory store at connect time.
 * - restaurant_id / tenant scope comes from the verified token, never from a
 *   client-chosen channel name.
 * - WS close code 1008 (Policy Violation) means the server rejected our
 *   credentials; we do NOT reconnect in that case.
 */
import { getAccessToken } from '@/services/api'
import { WS_BASE_URL } from '@/lib/config'

export type MessageHandler = (data: unknown) => void

export interface WsConfig {
  onMessage: MessageHandler
  onOpen?: () => void
  onClose?: (wasClean: boolean) => void
}

const WS_POLICY_VIOLATION = 1008
const MAX_BACKOFF_MS = 30_000

// Keepalive: send a lightweight ping so the client→server leg stays active, and
// treat any silence longer than STALE_MS as a dead (half-open) socket. The server
// heartbeats every ~25s, so a healthy connection is never stale; a connection
// dropped by a proxy (Cloudflare ~100s idle) or a network switch is detected and
// re-established within ~STALE_MS instead of hanging silently until who-knows-when.
const PING_INTERVAL_MS = 20_000
const STALE_MS = 45_000

function buildStaffWsUrl(): string | null {
  const token = getAccessToken()
  if (!token) return null
  return `${WS_BASE_URL}/ws/staff?token=${encodeURIComponent(token)}`
}

export class ReconnectingWs {
  private ws: WebSocket | null = null
  private destroyed = false
  private retryDelayMs = 1_000
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastActivity = 0

  constructor(private readonly config: WsConfig) {
    this.connect()
  }

  private connect(): void {
    if (this.destroyed) return

    const url = buildStaffWsUrl()
    if (!url) return // token not yet available; caller should recreate when ready

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelayMs = 1_000
      this.lastActivity = Date.now()
      this.startHeartbeat()
      this.config.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      // Any frame (event OR server heartbeat) proves the socket is alive.
      this.lastActivity = Date.now()
      try {
        const data = JSON.parse(String(event.data)) as unknown
        // Swallow keepalive frames; screens only care about domain events.
        if ((data as { type?: unknown } | null)?.type === 'heartbeat') return
        this.config.onMessage(data)
      } catch {
        // discard malformed frames
      }
    }

    this.ws.onclose = (event) => {
      this.stopHeartbeat()
      this.config.onClose?.(event.code === 1000)
      if (this.destroyed || event.code === WS_POLICY_VIOLATION) return
      // Exponential backoff reconnect.
      this.retryTimer = setTimeout(() => {
        this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_BACKOFF_MS)
        this.connect()
      }, this.retryDelayMs)
    }

    this.ws.onerror = () => {
      // onclose fires after onerror; reconnect is handled there.
    }
  }

  /** Ping periodically and force-reconnect a socket that has gone silent. */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > STALE_MS) {
        this.forceReconnect()
        return
      }
      try {
        this.ws?.send('ping')
      } catch {
        /* a failed send surfaces as onclose */
      }
    }, PING_INTERVAL_MS)
  }

  /**
   * Tear down a half-open socket and reconnect immediately. We detach the old
   * socket's handlers first so its (possibly delayed or never-firing) onclose
   * cannot also schedule a backoff reconnect — exactly one reconnect happens.
   */
  private forceReconnect(): void {
    this.stopHeartbeat()
    const old = this.ws
    this.ws = null
    if (old) {
      old.onopen = null
      old.onmessage = null
      old.onclose = null
      old.onerror = null
      try {
        old.close()
      } catch {
        /* ignore */
      }
    }
    this.retryDelayMs = 1_000
    this.connect()
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  destroy(): void {
    this.destroyed = true
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.stopHeartbeat()
    this.ws?.close()
  }
}
