/**
 * Safe accessor for `expo-notifications`.
 *
 * Since SDK 53, `expo-notifications` throws at **import time** in Expo Go on
 * Android (push support was removed — see
 * https://docs.expo.dev/develop/development-builds/introduction/). A static
 * `import` therefore crashes the whole app the moment Expo Go loads it.
 *
 * To keep the app runnable in Expo Go for day-to-day UI work, we detect the
 * Expo Go runtime and only `require()` the native module outside it. In a
 * development or production build the real module loads and staff alerts work
 * normally; in Expo Go `Notifications` is `null` and callers no-op.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants'

/** True when running inside the Expo Go client (`storeClient`). */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient

type NotificationsModule = typeof import('expo-notifications')

let mod: NotificationsModule | null = null
if (!isExpoGo) {
  // Lazy require: a static import would eval expo-notifications' top-level code
  // and throw in Expo Go before this guard could run. The try/catch is a
  // belt-and-suspenders guard in case the runtime check ever misdetects Expo Go
  // — a failed load just disables notifications instead of crashing the app.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule
  } catch {
    mod = null
  }
}

/** The native module, or `null` when unavailable (Expo Go). */
export const Notifications: NotificationsModule | null = mod
