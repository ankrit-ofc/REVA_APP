import { useEffect, useRef } from 'react'
import { ReconnectingWs } from './ws'
import { useAuth } from '@/features/auth/useAuth'
import type { RealtimeEvent } from '@/types'

/**
 * Establishes an authenticated staff WebSocket.
 * Destroyed and recreated if authentication state changes.
 * Screens attach cache-invalidation / alert handlers via the onEvent prop.
 */
export function useStaffRealtime(onEvent?: (event: RealtimeEvent) => void): void {
  const { isAuthenticated } = useAuth()
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!isAuthenticated) return

    const ws = new ReconnectingWs({
      onMessage(data) {
        const ev = data as RealtimeEvent
        if (ev?.type) {
          onEventRef.current?.(ev)
        }
      },
    })

    return () => {
      ws.destroy()
    }
  }, [isAuthenticated])
}
