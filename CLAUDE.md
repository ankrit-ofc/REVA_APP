@AGENTS.md

# CLAUDE.md — read before any work in this repo

## What this repo is
STAFF MOBILE APP (React Native/Expo). Ships via `eas build -p android --profile production` → APK sideloaded to staff phones.
NOT deploy.sh. NOT revatap.com web. The web admin repo is separate (Multi_Tenant_QR_Resturant_Management-main).
Staff-facing features are built HERE.

## Settled decisions — do not reverse without explicit instruction from Ankrit
- Foreground pushes: SHOW (banner+sound even with app open). A missed order costs more than a duplicate alert.
- Push channel: app CHANNEL_ID ('staff-v2', useStaffAlerts.ts) MUST equal backend _ANDROID_CHANNEL (push_service.py). Changing either alone silently breaks lock-screen alerts.
- Optimistic updates are remove-based: completed items leave their lists instantly (queue/ready/pending endpoints exclude completed items).
- All staff phones must run the @ank.ofc EAS build. Old @lan_tian-project tokens poison the Expo push batch (PUSH_TOO_MANY_EXPERIENCE_IDS).

## Known traps
- eas.json: "buildType": "apk" must be inside the profile actually built (production), nested under android.
- New keystore = signature mismatch: phones must UNINSTALL the old app before installing a new-keystore APK.
- Never commit fcm-key.json, *.jks, .env.
- Emulator is unreliable for push-display testing; real phone is the truth.

## Session rules
- One task per session. Pending items go in a list at the END of output, never acted on.
- Paste raw command output as evidence for every claim.
- Show diffs before committing. Never eas build / push without explicit go.
