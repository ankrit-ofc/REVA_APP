/**
 * Safe accessor for `@notifee/react-native`, mirroring `lib/notifications.ts`.
 *
 * The notifee native module is absent in Expo Go, where a static import throws
 * at load time. We lazy-`require()` it only outside Expo Go so the app still
 * runs in Expo Go for day-to-day UI work — the background foreground service is
 * simply disabled there (it can't run in Expo Go anyway).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants'

/** True when running inside the Expo Go client (`storeClient`). */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

type NotifeeModule = typeof import('@notifee/react-native')

let mod: NotifeeModule | null = null
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@notifee/react-native') as NotifeeModule
  } catch {
    mod = null
  }
}

/** The notifee default export (its API), or `null` when unavailable (Expo Go). */
export const notifee: NotifeeModule['default'] | null = mod?.default ?? null

/** Enums used by callers — safe to leave undefined in Expo Go (callers guard on `notifee`). */
export const AndroidImportance = mod?.AndroidImportance
export const AndroidVisibility = mod?.AndroidVisibility
