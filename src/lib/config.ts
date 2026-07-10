/**
 * Runtime configuration for the mobile app.
 *
 * The backend base URL is injected at build time via `EXPO_PUBLIC_API_BASE_URL`
 * (Expo inlines any `EXPO_PUBLIC_*` env var). There is no same-origin / proxy
 * fallback on native, so an absolute URL is always required.
 *
 * Defaults target the Android emulator (`10.0.2.2` maps to the host machine's
 * localhost). Override per environment:
 *   - Android emulator : http://10.0.2.2:8000        (default)
 *   - iOS simulator    : http://localhost:8000
 *   - Physical device  : http://<PC-LAN-IP>:8000
 *   - Production        : https://<your-domain>
 */
const DEFAULT_BASE_URL = 'http://10.0.2.2:8000'

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || DEFAULT_BASE_URL

/** WebSocket base derived from the API base (http→ws, https→wss). */
export const WS_BASE_URL: string = API_BASE_URL.replace(/^http/, 'ws')
