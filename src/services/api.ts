/**
 * Axios instance for the staff mobile client.
 *
 * - **Access token** lives in memory only (never persisted) — same design as the
 *   web app (Decision D1).
 * - **Refresh token** is an HttpOnly cookie set by the backend on `/auth/*`. On
 *   React Native the native networking layer (OkHttp / NSURLSession) keeps a
 *   cookie jar and resends the cookie automatically — there is no browser and no
 *   JS cookie library involved. The cookie carries a max-age, so the native jar
 *   persists it across app restarts; on cold start we call `/auth/refresh` and,
 *   if the jar still holds a valid cookie, silently restore the session.
 * - On a 401 we run a single de-duplicated `POST /auth/refresh` and retry once.
 *   On refresh failure we fire `onRefreshFailed` so the auth slice can clear state.
 */
import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '@/lib/config'

// ── In-memory token store ─────────────────────────────────────────────────────

let _accessToken: string | null = null
let _onRefreshFailed: (() => void) | null = null

export const getAccessToken = (): string | null => _accessToken
export const setAccessToken = (t: string | null): void => {
  _accessToken = t
}

/** Called by the app bootstrap to wire up the logout action on refresh failure. */
export const setOnRefreshFailed = (cb: () => void): void => {
  _onRefreshFailed = cb
}

// ── Axios instance ────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Sending an explicit JSON Accept makes a reverse proxy (Caddy in prod) route
  // to the API rather than falling back to the SPA for shared path prefixes.
  headers: { Accept: 'application/json' },
  // No-op on native (cookies always flow through the native jar) but harmless.
  withCredentials: true,
})

// Attach the access token on every outgoing request.
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`
  }
  return config
})

// ── 401 → refresh → retry ────────────────────────────────────────────────────

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Single in-flight refresh promise so concurrent 401s don't race.
let _refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined

    // Don't retry if: not a 401, already retried, or this IS the refresh call.
    if (
      error.response?.status !== 401 ||
      config?._retry ||
      config?.url === '/auth/refresh'
    ) {
      return Promise.reject(error)
    }

    if (config) config._retry = true

    if (!_refreshPromise) {
      _refreshPromise = api
        .post<{ access_token: string }>('/auth/refresh')
        .then((res) => {
          setAccessToken(res.data.access_token)
          return res.data.access_token
        })
        .catch((refreshErr: unknown) => {
          setAccessToken(null)
          _onRefreshFailed?.()
          return Promise.reject(refreshErr)
        })
        .finally(() => {
          _refreshPromise = null
        })
    }

    try {
      const newToken = await _refreshPromise
      if (config) {
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config)
      }
    } catch {
      // refresh failed; already handled above
    }
    return Promise.reject(error)
  },
)

// ── RTK Query base query helper ───────────────────────────────────────────────

export const axiosBaseQuery: BaseQueryFn<
  AxiosRequestConfig,
  unknown,
  { status?: number; data?: unknown; message?: string }
> = async (config) => {
  try {
    const result = await api(config)
    return { data: result.data as unknown }
  } catch (e) {
    const err = e as AxiosError
    return {
      error: {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      },
    }
  }
}
