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
      this.config.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as unknown
        this.config.onMessage(data)
      } catch {
        // discard malformed frames
      }
    }

    this.ws.onclose = (event) => {
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

  destroy(): void {
    this.destroyed = true
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.ws?.close()
  }
}
