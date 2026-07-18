/**
 * Authenticated staff WebSocket client with exponential-backoff reconnection.
 * React Native provides a global `WebSocket`, so this is nearly identical to the
 * web client; only the base URL source differs (build-time env, not window.location).
 *
 * Security invariants:
 * - Long-lived credentials NEVER appear in the WS URL. Each connect attempt
 *   (including reconnects) first POSTs to /auth/ws-ticket — authenticated via
 *   the normal Bearer interceptor — and receives a short-lived single-use
 *   ticket, which is the only thing in the query string. The backend rejects
 *   raw ?token= connections with close code 1008.
 * - restaurant_id / tenant scope comes from the server-side ticket, never from
 *   a client-chosen channel name.
 * - WS close code 1008 (Policy Violation) means the server rejected our
 *   credentials. Because a single-use ticket can expire in transit (e.g. a
 *   connect delayed past its 60s TTL), one refresh-and-retry is allowed per
 *   established connection; a second consecutive 1008 is treated as fatal —
 *   we stop reconnecting and report it via onFatal so the UI can offer a
 *   manual retry instead of hammering the server.
 */
import { api, getAccessToken } from '@/services/api'
import { WS_BASE_URL } from '@/lib/config'

export type MessageHandler = (data: unknown) => void

export interface WsConfig {
  onMessage: MessageHandler
  onOpen?: () => void
  onClose?: (wasClean: boolean) => void
  /** The server rejected our credentials twice in a row; reconnection stopped. */
  onFatal?: () => void
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

/**
 * Fetch a fresh single-use ticket and build the WS URL.
 * Returns null when no access token is available yet (caller recreates later);
 * throws when the ticket request itself fails (caller retries with backoff).
 */
export async function buildStaffWsUrl(): Promise<string | null> {
  if (!getAccessToken()) return null

  const response = await api.post('/auth/ws-ticket')
  const ticket: unknown = (response.data as { ticket?: unknown } | null)?.ticket
  if (typeof ticket !== 'string' || ticket.length === 0) {
    throw new Error('Malformed ws-ticket response')
  }
  return `${WS_BASE_URL}/ws/staff?ticket=${encodeURIComponent(ticket)}`
}

export class ReconnectingWs {
  private ws: WebSocket | null = null
  private destroyed = false
  private fatal = false
  private retryDelayMs = 1_000
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastActivity = 0
  /** Set after a 1008 close; a second 1008 without a successful open is fatal. */
  private policyRetryUsed = false

  constructor(private readonly config: WsConfig) {
    this.connect()
  }

  private connect(): void {
    if (this.destroyed || this.fatal) return
    void this.connectAsync()
  }

  private async connectAsync(): Promise<void> {
    let url: string | null
    try {
      url = await buildStaffWsUrl()
    } catch {
      // Ticket fetch failed (network / backend restart) — retry with backoff.
      this.scheduleReconnect()
      return
    }
    if (this.destroyed || this.fatal) return
    if (!url) return // token not yet available; caller should recreate when ready

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.retryDelayMs = 1_000
      this.policyRetryUsed = false
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
      if (this.destroyed) return
      if (event.code === WS_POLICY_VIOLATION) {
        if (this.policyRetryUsed) {
          // Second consecutive rejection: our credentials are genuinely refused.
          this.fatal = true
          this.config.onFatal?.()
          return
        }
        // First rejection may just be an expired single-use ticket — retry once
        // with a fresh ticket (fetched by the next connect) after a backoff.
        this.policyRetryUsed = true
      }
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onclose fires after onerror; reconnect is handled there.
    }
  }

  /** Exponential-backoff reconnect (shared by onclose and ticket-fetch failures). */
  private scheduleReconnect(): void {
    if (this.destroyed || this.fatal) return
    this.retryTimer = setTimeout(() => {
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_BACKOFF_MS)
      this.connect()
    }, this.retryDelayMs)
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
