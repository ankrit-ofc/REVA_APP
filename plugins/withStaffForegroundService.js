/**
 * Expo config plugin: wire up notifee's Android foreground service for the
 * background staff order-notification connection (see
 * src/features/background/foregroundService.ts).
 *
 * Expo-managed apps can't hand-edit AndroidManifest.xml, so we mutate it at
 * prebuild time:
 *   1. Add the foreground-service + notification permissions.
 *   2. Override notifee's `app.notifee.core.ForegroundService` declaration to
 *      set `android:foregroundServiceType="specialUse"` — using `tools:replace`
 *      so our value wins the manifest merge against notifee's default — and add
 *      the PROPERTY_SPECIAL_USE_FGS_SUBTYPE property Android 14+ requires.
 *
 * Why `specialUse` and not `dataSync`: Android 15 caps `dataSync` foreground
 * services at ~6 hours/day, which would silently stop an always-on staff
 * device. `specialUse` has no such cap. It needs a Play Store justification, but
 * this app ships via internal APK distribution (no Play review).
 */
const { withAndroidManifest } = require('@expo/config-plugins')

const NOTIFEE_SERVICE = 'app.notifee.core.ForegroundService'
const SUBTYPE =
  'Maintains the persistent connection that alerts restaurant staff to new ' +
  'orders and waiter calls while the app is in the background.'

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
]

function ensureToolsNamespace(manifest) {
  manifest.$ = manifest.$ || {}
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'
  }
}

function addPermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] || []
  const existing = new Set(
    manifest['uses-permission'].map((p) => p.$ && p.$['android:name']),
  )
  for (const name of PERMISSIONS) {
    if (!existing.has(name)) {
      manifest['uses-permission'].push({ $: { 'android:name': name } })
    }
  }
}

function overrideNotifeeService(manifest) {
  const application = manifest.application && manifest.application[0]
  if (!application) return
  application.service = application.service || []
  // Idempotent: drop any prior copy we added, then re-add.
  application.service = application.service.filter(
    (s) => !(s.$ && s.$['android:name'] === NOTIFEE_SERVICE),
  )
  application.service.push({
    $: {
      'android:name': NOTIFEE_SERVICE,
      'android:foregroundServiceType': 'specialUse',
      'tools:replace': 'android:foregroundServiceType',
    },
    property: [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': SUBTYPE,
        },
      },
    ],
  })
}

module.exports = function withStaffForegroundService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    ensureToolsNamespace(manifest)
    addPermissions(manifest)
    overrideNotifeeService(manifest)
    return cfg
  })
}
