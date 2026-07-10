# Reva Mobile (staff)

React Native (Expo) app that reproduces the **staff** functionality of the Reva
multi-tenant QR restaurant/POS web app, pointing at the **same backend**. It is
staff-only — customers keep using the web QR flow. The role in the login JWT
decides which surface you land on (kitchen, waiter, counter, counter display,
admin, or superadmin).

## What's included

- **Auth**: login (restaurant slug + email + password + remember me), forgot /
  reset password. Access token held in memory; the refresh token is the backend's
  HttpOnly cookie, kept by the OS cookie jar (silent refresh on 401 and on launch).
- **Kitchen**: live queue, start-preparing / mark-ready / cancel.
- **Waiter**: ready-to-serve, pending approvals (approve/reject), open tables,
  move-to-billing, and a billing screen (when the restaurant enables waiter payments).
- **Counter**: full billing flow — open tables → billing queue → invoice → payment
  (cash/card/wallet), admin manual override, reopen / close-unpaid; plus the
  passive counter display board.
- **Admin**: categories, products (incl. image upload), add-ons, staff, tables,
  and settings (order-approval toggle, printer settings, KOT worker token).
- **Superadmin**: list / create / activate restaurants.
- **Realtime**: authenticated staff WebSocket drives live refresh + local
  notifications for new orders, approvals, ready items, bill requests, waiter calls.

## Not included (by design)

- The customer QR/menu/cart/order flow (web only).
- Receipt/KOT printing on-device — the web app printed via WebUSB, which doesn't
  exist in React Native. Physical printing continues to run server-side through
  the existing KOT print worker (worker mode). The mobile app can still trigger a
  KOT reprint and manage printer settings/token.

## Prerequisites

- Node 20+ and the Reva backend running (see the main repo; dev backend listens on
  `:8000`).
- A **custom dev build** — this app uses native modules (`expo-secure-store`,
  `expo-notifications`, `expo-image-picker`), so **Expo Go will not work**. Use
  `npx expo run:android` / `npx expo run:ios`, or an EAS dev build.

## Configure the backend URL

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` (copy `.env.example`). Pick the value for
your target:

| Target | URL |
|---|---|
| Android emulator | `http://10.0.2.2:8000` (default) |
| iOS simulator | `http://localhost:8000` |
| Physical device on LAN | `http://<PC-LAN-IP>:8000` |
| Production | `https://<your-domain>` |

Android cleartext HTTP (for LAN/emulator dev) is enabled via
`android.usesCleartextTraffic` in `app.json`.

## Run

```bash
npm install
# first run builds the native dev client:
npx expo run:android      # or: npx expo run:ios
```

Then sign in with staff credentials for your restaurant. The role in the account
determines the screens shown.

## Type-check / bundle

```bash
npx tsc --noEmit
npx expo export --platform android   # headless Metro bundle check
```

## How it maps to the web app

Pure-logic modules (RTK Query API slices, Zod schemas, the auth slice, the JWT
decode, the reconnecting WebSocket client) are ported nearly verbatim from
`frontend/src`. Only the platform edges differ: axios base URL comes from
`EXPO_PUBLIC_API_BASE_URL`, the refresh token rides the native cookie jar instead
of a browser cookie, storage/notifications use Expo modules, and the UI is rebuilt
with React Native + React Navigation instead of the web router and CSS Modules.
No backend changes were made.
