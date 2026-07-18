/**
 * Contract tests for the staff WebSocket client.
 *
 * These exist because of a real outage: the backend cut WS auth over to
 * single-use tickets (main repo, fix/auth-hardening @ dd1a72d) and this app —
 * living in a separate repo — kept connecting with ?token=, was rejected with
 * close code 1008, and went silently dead. The assertions below pin the two
 * behaviours that prevent a repeat:
 *   1. the WS URL carries ONLY a ticket, never a raw token, and
 *   2. a 1008 rejection triggers exactly one fresh-ticket retry before the
 *      client gives up and reports a fatal disconnect (no silence, no hammering).
 */
import { buildStaffWsUrl, ReconnectingWs } from '../ws'
import { api, getAccessToken } from '@/services/api'

jest.mock('@/services/api', () => ({
  api: { post: jest.fn() },
  getAccessToken: jest.fn(),
}))

const mockPost = api.post as jest.Mock
const mockGetAccessToken = getAccessToken as jest.Mock

// ── Controllable WebSocket stub ───────────────────────────────────────────────

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number; reason?: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(): void {}
  close(): void {}
}

beforeEach(() => {
  jest.useFakeTimers()
  FakeWebSocket.instances = []
  mockPost.mockReset()
  mockGetAccessToken.mockReset()
  mockGetAccessToken.mockReturnValue('a-staff-jwt')
  let n = 0
  mockPost.mockImplementation(() => Promise.resolve({ data: { ticket: `ticket-${++n}` } }))
  ;(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket
})

afterEach(() => {
  jest.useRealTimers()
  delete (globalThis as { WebSocket?: unknown }).WebSocket
})

/** Flush pending microtasks (the ticket fetch) plus any due fake timers. */
const settle = async (ms = 0) => {
  await jest.advanceTimersByTimeAsync(ms)
}

// ── URL contract ──────────────────────────────────────────────────────────────

describe('buildStaffWsUrl', () => {
  it('mints a single-use ticket and puts ONLY the ticket in the URL', async () => {
    const url = await buildStaffWsUrl()
    expect(mockPost).toHaveBeenCalledWith('/auth/ws-ticket')
    expect(url).toContain('/ws/staff?ticket=ticket-1')
    // The raw credential must never appear in the query string — the backend
    // rejects ?token=/?session_token= with close code 1008.
    expect(url).not.toMatch(/[?&](token|session_token)=/)
    expect(url).not.toContain('a-staff-jwt')
  })

  it('returns null when no access token is available yet', async () => {
    mockGetAccessToken.mockReturnValue(null)
    expect(await buildStaffWsUrl()).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('throws on a malformed ticket response', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await expect(buildStaffWsUrl()).rejects.toThrow('Malformed ws-ticket response')
  })
})

// ── 1008 policy: exactly one fresh-ticket retry, then fatal ──────────────────

describe('ReconnectingWs on close code 1008', () => {
  it('retries exactly once with a fresh ticket, then reports fatal and stops', async () => {
    const onFatal = jest.fn()
    const client = new ReconnectingWs({ onMessage: jest.fn(), onFatal })
    await settle()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toContain('ticket=ticket-1')

    // First rejection: could be an expired single-use ticket → one retry.
    FakeWebSocket.instances[0].onclose?.({ code: 1008 })
    await settle(1_000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.instances[1].url).toContain('ticket=ticket-2') // fresh, not reused
    expect(onFatal).not.toHaveBeenCalled()

    // Second consecutive rejection: credentials genuinely refused → fatal.
    FakeWebSocket.instances[1].onclose?.({ code: 1008 })
    await settle(120_000)
    expect(onFatal).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(2) // no further attempts — no hammering

    client.destroy()
  })

  it('a successful open resets the retry budget', async () => {
    const onFatal = jest.fn()
    const client = new ReconnectingWs({ onMessage: jest.fn(), onFatal })
    await settle()

    FakeWebSocket.instances[0].onclose?.({ code: 1008 })
    await settle(1_000)
    // Retry connects successfully — the earlier 1008 is forgiven.
    FakeWebSocket.instances[1].onopen?.()

    // A later 1008 (e.g. after hours online) gets its own single retry again.
    FakeWebSocket.instances[1].onclose?.({ code: 1008 })
    await settle(5_000)
    expect(FakeWebSocket.instances).toHaveLength(3)
    expect(onFatal).not.toHaveBeenCalled()

    client.destroy()
  })

  it('reconnects with backoff on ordinary closes without consuming the 1008 budget', async () => {
    const onFatal = jest.fn()
    const client = new ReconnectingWs({ onMessage: jest.fn(), onFatal })
    await settle()

    FakeWebSocket.instances[0].onclose?.({ code: 1006 }) // abnormal network drop
    await settle(1_000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(onFatal).not.toHaveBeenCalled()

    client.destroy()
  })
})
