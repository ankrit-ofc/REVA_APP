import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { api, setAccessToken, setOnRefreshFailed } from '@/services/api'
import { _applyToken } from '@/features/auth/authApi'
import { sessionEnded } from '@/features/auth/authSlice'
import type { AppDispatch } from '@/store/store'

/**
 * On launch, attempt a silent `POST /auth/refresh`. If the native cookie jar
 * still holds a valid refresh cookie (persisted from a prior session), this
 * restores the login without prompting. Any failure just leaves the user on the
 * login screen. Also registers the refresh-failure callback so a later 401 that
 * can't be refreshed tears the session down with the "signed out" notice.
 *
 * Returns `true` once the initial refresh attempt has settled.
 */
export function useAuthBootstrap(): boolean {
  const dispatch = useDispatch<AppDispatch>()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setOnRefreshFailed(() => {
      setAccessToken(null)
      dispatch(sessionEnded())
    })

    let cancelled = false
    ;(async () => {
      try {
        const res = await api.post<{ access_token: string }>('/auth/refresh')
        if (!cancelled) _applyToken(res.data.access_token, dispatch as AppDispatch)
      } catch {
        // No valid refresh cookie — stay logged out.
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dispatch])

  return ready
}
