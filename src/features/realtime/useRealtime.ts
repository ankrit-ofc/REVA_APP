import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReconnectingWs } from './ws'
import { useAuth } from '@/features/auth/useAuth'
import { realtimeFatal } from '@/features/ui/uiSlice'
import type { AppDispatch, RootState } from '@/store/store'
import type { RealtimeEvent } from '@/types'

/**
 * Establishes an authenticated staff WebSocket (ticket-based; see ws.ts).
 * Destroyed and recreated if authentication state changes, and when the user
 * taps the retry banner after the connection went fatally down (retry nonce).
 * Screens attach cache-invalidation / alert handlers via the onEvent prop.
 */
export function useStaffRealtime(onEvent?: (event: RealtimeEvent) => void): void {
  const { isAuthenticated } = useAuth()
  const dispatch = useDispatch<AppDispatch>()
  const retryNonce = useSelector((s: RootState) => s.ui.realtimeRetryNonce)
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
      onFatal() {
        dispatch(realtimeFatal())
      },
    })

    return () => {
      ws.destroy()
    }
  }, [isAuthenticated, retryNonce, dispatch])
}
