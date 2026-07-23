# REVA Staff App — End-to-End Flow

Traced from source at commit `1adeaee` (branch `master`) with six files modified in the
working tree. Every non-obvious claim carries a `path/file.ts:line` citation. Where a
statement could not be confirmed from this repository it is marked **not found** or
flagged as an unverified source-comment claim.

**Repo:** `StormDraco/reva-tap` — a **separate repository** from the backend
(`ankrit-ofc/REVA-ONE-TAP-MENU-`, deployed at `/opt/app`). Endpoint names below are the
contract surface; cross-check them against the backend's `ARCHITECTURE.md`.

---

## 1. App structure & entry

### Entry chain

```
index.ts:8  registerRootComponent(App)
   └─ App.tsx:8   <Provider store> → <SafeAreaProvider> → <NavigationContainer> → <RootNavigator>
        └─ navigation/RootNavigator.tsx:9   useAuthBootstrap()  → splash spinner until settled
             ├─ not authenticated → AuthNavigator.tsx:11   (Login / ForgotPassword / ResetPassword)
             └─ authenticated     → AppNavigator.tsx:152   role switch
```

`RootNavigator.tsx:20` is the only auth gate: `isAuthenticated ? <AppNavigator/> : <AuthNavigator/>`.

### Role → surface mapping

`AppNavigator.tsx:157-176` switches on the role decoded from the JWT. `COUNTER` is also
the `default` branch, so an unknown role lands on the counter surface
(`AppNavigator.tsx:173-175`).

| Role | Navigator | Type |
|---|---|---|
| `SUPERADMIN` | `SuperadminNavigator` (:140) | stack |
| `ADMIN` | `AdminNavigator` (:124) | stack |
| `KITCHEN` | `KitchenNavigator` (:56) | stack |
| `WAITER` | `WaiterNavigator` (:66) | bottom tabs |
| `COUNTER_DISPLAY` | `DisplayNavigator` (:114) | stack |
| `COUNTER` / *fallback* | `CounterNavigator` (:95) | bottom tabs |

`RealtimeBanner` is rendered above every surface (`AppNavigator.tsx:180`) and
`useStaffAlerts()` is mounted once at `AppNavigator.tsx:154`.

### Screen inventory → backend router

| Screen | File | Role | Backend router |
|---|---|---|---|
| Login | `screens/auth/LoginScreen.tsx` | unauthenticated | `/auth` |
| Forgot password | `screens/auth/ForgotPasswordScreen.tsx` | unauthenticated | `/auth` |
| Reset password | `screens/auth/ResetPasswordScreen.tsx` | unauthenticated | `/auth` |
| Kitchen | `screens/kitchen/KitchenScreen.tsx` | KITCHEN | `/kitchen` |
| Calls | `screens/waiter/WaiterCallsScreen.tsx` | WAITER | `/waiter` |
| Serve | `screens/waiter/WaiterReadyScreen.tsx` | WAITER | `/waiter` |
| Orders | `screens/waiter/WaiterOrdersScreen.tsx` | WAITER | `/waiter` |
| Waiter Billing | `screens/waiter/WaiterBillingScreen.tsx` | WAITER | `/waiter/billing-enabled` + `/counter` + `/invoices` |
| Counter Billing | `screens/counter/CounterBillingScreen.tsx` | COUNTER | `/counter` + `/invoices` |
| Counter Display | `screens/counter/CounterDisplayScreen.tsx` | COUNTER, COUNTER_DISPLAY | `/counter-display` |
| Billing (shared body) | `screens/billing/BillingView.tsx` | COUNTER + WAITER | `/counter`, `/invoices` |
| Admin home | `screens/admin/AdminHomeScreen.tsx` | ADMIN | — (menu) |
| Categories / Products / Add-ons / Staff / Tables / Settings | `screens/admin/*.tsx` | ADMIN | `/admin` |
| Restaurants | `screens/superadmin/RestaurantsScreen.tsx` | SUPERADMIN | `/superadmin` |

`CounterDisplayScreen` is registered twice — as the Display tab of `CounterNavigator`
(`AppNavigator.tsx:103-107`) and as the sole screen of `DisplayNavigator`
(`AppNavigator.tsx:117`).

---

## 2. Auth flow

### Login

```
LoginScreen.onSubmit()                       screens/auth/LoginScreen.tsx:56
  └─ loginRequestSchema.safeParse({restaurant_slug, email, password, remember_me})   :58
  └─ login(...).unwrap()   → POST /auth/login          features/auth/authApi.ts:30
       └─ onQueryStarted → _applyToken(data.access_token, dispatch)   authApi.ts:34
            ├─ setAccessToken(token)         services/api.ts:27   (in-memory only)
            └─ decodeJwtPayload(token) → dispatch(setCredentials({userId, restaurantId, role}))
                                                      authApi.ts:64-71
  └─ AsyncStorage.setItem('last_restaurant_slug', slug)   LoginScreen.tsx:81
```

No manual navigation on success — the auth slice flips `isAuthenticated` and
`RootNavigator` swaps surfaces (`LoginScreen.tsx:77-79`). A 401 renders "Invalid
restaurant, email, or password." (`LoginScreen.tsx:85-87`).

### Credential storage — two tiers, neither is secure storage

| Item | Where | Citation |
|---|---|---|
| Access token (JWT) | **module-level variable, in memory only, never persisted** | `services/api.ts:23`, `:26-29` |
| Refresh token | **HttpOnly cookie held by the native cookie jar** (OkHttp / NSURLSession) — no JS involvement | `services/api.ts:5-11` |
| Last restaurant slug | `AsyncStorage` key `last_restaurant_slug` | `LoginScreen.tsx:23`, `:81` |
| Staff-alert preference | `AsyncStorage` key `staff_alerts_enabled` | `lib/useStaffAlerts.ts:10`, `:56` |

`expo-secure-store` is declared as a dependency (`package.json:17`) and as an Expo plugin
(`app.json:28`) but **is never imported anywhere in `src/`** — see §10.

### Attaching the token

A request interceptor sets `Authorization: Bearer <token>` on every outgoing call when a
token is present (`services/api.ts:48-53`).

### Session restore & 401 handling

```
cold start → useAuthBootstrap()                       bootstrap/useAuthBootstrap.ts:17
   ├─ setOnRefreshFailed(() => setAccessToken(null); dispatch(sessionEnded()))   :22-25
   └─ POST /auth/refresh                                                          :30
        ├─ success → _applyToken() → logged straight in
        └─ failure → stay on login screen                                         :32
   finally → setReady(true)  (splash clears)                                      :35

any 401 → response interceptor                        services/api.ts:64-108
   ├─ skip if already retried, or the failing call IS /auth/refresh               :70-75
   ├─ single de-duplicated in-flight POST /auth/refresh (_refreshPromise)         :62, :80-95
   ├─ success → set new token, replay the original request                        :99-101
   └─ failure → setAccessToken(null) + _onRefreshFailed() → sessionEnded()        :87-91
```

`sessionEnded` raises `signedOutNotice`, which renders "You were signed out. This can
happen if the account signed in on another device." (`authSlice.ts:47-53`,
`LoginScreen.tsx:112-118`). Manual logout uses `clearAuth` and shows no notice
(`authSlice.ts:38`).

### Logout

`useAuth().logout` awaits `unregisterPush()` **before** tearing the session down, while
the access token is still valid (`features/auth/useAuth.ts:16-19`), then fires
`POST /auth/logout` (`authApi.ts:42`), whose `onQueryStarted` clears the token and
dispatches `clearAuth()` regardless of server outcome (`authApi.ts:43-48`).

---

## 3. API transport

### Base URL resolution

```
lib/config.ts:17   API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/,'')
                                  || 'http://10.0.2.2:8000'          (:15 DEFAULT_BASE_URL)
lib/config.ts:21   WS_BASE_URL  = API_BASE_URL.replace(/^http/,'ws')   → http→ws, https→wss
```

Expo inlines `EXPO_PUBLIC_*` at build time; there is no runtime override and no
same-origin fallback on native (`lib/config.ts:4-6`).

### Axios instance

`services/api.ts:38-45` — `baseURL: API_BASE_URL`, `headers: {Accept: 'application/json'}`
(so Caddy routes to the API rather than the SPA on shared path prefixes, `:40-41`),
`withCredentials: true` (a no-op on native, `:43`).

Interceptors: request → Bearer attach (`:48`); response → 401 refresh-and-retry (`:64`).

### RTK Query wiring

All six API slices use the shared `axiosBaseQuery` (`services/api.ts:112-130`), which
normalizes errors to `{status, data, message}` (`:122-126`) — the shape `errDetail()` /
`errStatus()` read (`lib/errors.ts:2`, `:16`). Slices registered in
`store/store.ts:16-32`: `authApi`, `kitchenApi`, `waiterApi`, `counterApi`,
`counterDisplayApi`, `adminApi`, `superadminApi`.

Responses are validated with Zod through `parseWith(schema)` as `transformResponse`
(e.g. `kitchenApi.ts:44`), which also coerces Decimal-as-string money fields
(`schemas/workflow.ts:11-12` uses `z.coerce.number()`).

### Full endpoint inventory

**Auth** — `features/auth/authApi.ts`
| Method | Path | Line |
|---|---|---|
| GET | `/auth/me` | :27 |
| POST | `/auth/login` | :30 |
| POST | `/auth/logout` | :42 |
| POST | `/auth/forgot-password` | :52 |
| POST | `/auth/reset-password` | :56 |
| POST | `/auth/refresh` | `services/api.ts:82`, `useAuthBootstrap.ts:30` |
| POST | `/auth/ws-ticket` | `features/realtime/ws.ts:53` |

**Kitchen** — `features/kitchen/kitchenApi.ts`
| Method | Path | Line |
|---|---|---|
| GET | `/kitchen/queue` | :42 |
| POST | `/kitchen/items/{id}/preparing` | :48 |
| POST | `/kitchen/items/{id}/ready` | :61 |
| POST | `/kitchen/items/{id}/cancel` | :74 |

**Waiter** — `features/waiter/waiterApi.ts`
| Method | Path | Line |
|---|---|---|
| GET | `/waiter/calls` | :44 |
| POST | `/waiter/calls/{id}/attend` | :49 |
| GET | `/waiter/ready` | :54 |
| GET | `/waiter/pending-approvals` | :60 |
| GET | `/waiter/open-orders` | :65 |
| GET | `/waiter/billing-enabled` | :69 |
| POST | `/waiter/items/{id}/served` | :72 |
| POST | `/waiter/orders/{id}/meal-finished` | :86 |
| POST | `/waiter/orders/{id}/reopen` | :96 |
| POST | `/waiter/orders/{id}/approve` | :105 |
| POST | `/waiter/orders/{id}/reject` | :121 |

**Counter / invoices** — `features/counter/counterApi.ts`
| Method | Path | Line |
|---|---|---|
| GET | `/counter/orders` | :31 |
| GET | `/counter/open-orders` | :35 |
| POST | `/counter/orders/{id}/print-kot` | :41 |
| POST | `/counter/orders/{id}/meal-finished` | :46 |
| POST | `/counter/orders/{id}/reopen` | :56 |
| POST | `/counter/orders/{id}/start-billing` | :64 |
| POST | `/counter/orders/{id}/close-unpaid` | :71 |
| POST | `/counter/orders/{id}/quick-bill` | :85 (+ `Idempotency-Key`, :87) |
| POST | `/invoices` | :93 |
| GET | `/invoices/{id}` | :98 |
| GET | `/invoices/{id}/receipt` | :103 |
| GET | `/counter/print-config` | :107 |
| POST | `/invoices/{id}/pay` | :116 (+ `Idempotency-Key`, :118) |
| POST | `/invoices/{id}/override` | :130 |

**Counter display** — `GET /counter-display/board` (`counterDisplayApi.ts:13`)

**Push** — `features/push/push.ts`
| Method | Path | Line |
|---|---|---|
| POST | `/push/register` | :68 |
| POST | `/push/unregister` | :84 |

**Admin** — `features/admin/adminApi.ts`: `/admin/categories` (GET :83, POST :87, PUT :91,
DELETE :95), `/admin/products` (GET :100, POST :106, PUT :111, DELETE :116),
`/admin/products/{id}/image` (POST :125), `/admin/products/{id}/variants`
(GET :134, POST :142, PUT :154, DELETE :163), `/admin/addons` (GET :170, POST :175,
PUT :180, DELETE :185), `/admin/products/{id}/addons` (GET :193, POST :201, DELETE :210),
`/admin/settings` (GET :216, PUT :220), `/admin/settings/kot-worker-token` (POST :224),
`/admin/staff` (GET :229, POST :233, PUT :237, DELETE :241),
`/admin/tables` (GET :246, POST :250, PUT :254, DELETE :258).

**Superadmin** — `features/superadmin/superadminApi.ts`: `/superadmin/restaurants`
(GET :23, POST :27, PUT :33), `/superadmin/restaurants/{rid}/admins/{uid}` (PUT :44).

---

## 4. Realtime (WebSocket)

### Ticket acquisition and URL

```
buildStaffWsUrl()                              features/realtime/ws.ts:50
  ├─ no access token → return null (caller retries later)          :51
  ├─ POST /auth/ws-ticket   (Bearer-authenticated via interceptor) :53
  ├─ malformed/empty ticket → throw 'Malformed ws-ticket response' :55-57
  └─ return `${WS_BASE_URL}/ws/staff?ticket=<encoded>`             :58
```

Security invariants documented at `ws.ts:6-19`: long-lived credentials never enter the WS
URL; tenant scope comes from the server-side ticket, not a client-chosen channel; the
backend rejects raw `?token=` with close code 1008.

### Connect / reconnect lifecycle

```
useStaffRealtime(onEvent)                      features/realtime/useRealtime.ts:15
  effect deps [isAuthenticated, retryNonce, dispatch]              :40
  ├─ not authenticated → no socket                                 :23
  ├─ new ReconnectingWs({onMessage, onFatal})                      :25
  └─ cleanup → ws.destroy()                                        :38
```

`ReconnectingWs` (`ws.ts:61`):
- exponential backoff from 1 s, capped at 30 s (`ws.ts:65`, `:143`, `MAX_BACKOFF_MS` :35)
- client ping every 20 s; any silence > 45 s is treated as a half-open socket and
  force-reconnected (`PING_INTERVAL_MS` :42, `STALE_MS` :43, `startHeartbeat` :149-161)
- `forceReconnect()` detaches the old socket's handlers first so exactly one reconnect
  happens (`ws.ts:169-186`)
- **1008 policy:** first `1008` may be an expired single-use ticket → one retry with a
  fresh ticket; a second consecutive `1008` without an intervening successful open is
  fatal → `onFatal()` and reconnection stops (`ws.ts:120-130`). A successful `onopen`
  resets both the backoff and the 1008 budget (`ws.ts:96-97`).
- ticket-fetch failure → backoff retry, no socket created (`ws.ts:85-88`)

`onFatal` dispatches `realtimeFatal()` (`useRealtime.ts:33`), which raises the
`RealtimeBanner` (`components/RealtimeBanner.tsx:18-28`); tapping it dispatches
`realtimeRetry()`, bumping `realtimeRetryNonce` (`features/ui/uiSlice.ts:34-37`) and
recreating every socket with a fresh ticket.

### Message handling

Frames are `JSON.parse`d; `{type:'heartbeat'}` is swallowed as keepalive; everything else
with a `type` is passed to the screen handler (`ws.ts:103-114`, `useRealtime.ts:26-31`).
Event envelope: `{type, restaurant_id, ...}` (`types/index.ts:10-14`).

### Event types consumed, per screen

| Event `type` | Consumers |
|---|---|
| `order.created` | Kitchen `KitchenScreen.tsx:20`; Orders `:28`; Serve `WaiterReadyScreen.tsx:55`; Display `CounterDisplayScreen.tsx:19`; Billing `BillingView.tsx:78`; alerts `alertMessages.ts:32` |
| `order_item.status_changed` | Kitchen `:20`; Orders `:33`; Serve `:54`; Display `:19`; alerts (only when `status === 'READY'`) `alertMessages.ts:41-44` |
| `order.status_changed` | Kitchen `:20`; Orders `:29`; Billing `BillingView.tsx:79` |
| `order.approval_requested` | Orders `:31`; alerts `alertMessages.ts:34` |
| `order.approval_decided` | Orders `:32`; Serve `:56` |
| `bill.requested` | Orders `:30`; Billing `:81`; alerts `alertMessages.ts:39` |
| `order.closed` | Billing `BillingView.tsx:80`, `:400` |
| `invoice.paid` | InvoiceView `BillingView.tsx:400` |
| `waiter.called` | Calls `WaiterCallsScreen.tsx:38`; alerts `alertMessages.ts:31` |
| `waiter.call_attended` | Calls `WaiterCallsScreen.tsx:38` |
| `heartbeat` | swallowed in transport `ws.ts:109` |

### `fix/ws-ticket-auth` status — **MERGED**

`d6d7745 Merge pull request #1 from StormDraco/fix/ws-ticket-auth` sits in master's
history, and `git branch -a --merged master` lists both `fix/ws-ticket-auth` and
`remotes/origin/fix/ws-ticket-auth`. The ticket code is live on master (`ws.ts:50-59`) and
pinned by contract tests written after the real outage described at
`features/realtime/__tests__/ws.test.ts:1-12`. The branch is a stale leftover.

---

## 5. Push notifications (receive side)

### Module guard

`expo-notifications` throws at **import time** in Expo Go on Android since SDK 53, so it is
lazily `require()`d only outside Expo Go; in Expo Go `Notifications` is `null` and every
caller no-ops (`lib/notifications.ts:17-37`).

### Registration

```
registerForPush()                              features/push/push.ts:51
  ├─ ensureChannel()  → Android channel 'staff-orders'             :34-44
  │     importance MAX, lockscreen PUBLIC, sound default, vibrate [300,500]
  ├─ getPermissionsAsync → requestPermissionsAsync if not granted  :56-60
  ├─ projectId() from Constants.expoConfig.extra.eas.projectId     :28-31
  │     → absent ⇒ return (no token can be minted)                 :63
  ├─ getExpoPushTokenAsync({projectId})                            :65
  └─ POST /push/register {token, platform:'ios'|'android'}         :68-71
```

Wholly best-effort: the entire body is wrapped in `try/catch` that swallows failures so
login is never blocked (`push.ts:73-75`). Called from the `useStaffAlerts` mount effect
(`lib/useStaffAlerts.ts:62`), which itself mounts once at `AppNavigator.tsx:154` — i.e.
**after** authentication, not at app start.

`unregisterPush()` → `POST /push/unregister {token}`, guarded on a module-level
`registeredToken` and skipped when null (`push.ts:79-88`); invoked from
`useAuth().logout` before the session teardown (`useAuth.ts:17`).

### Foreground vs background

```
BACKGROUND / CLOSED → OS renders the push directly; the JS handler never runs
                      (lib/useStaffAlerts.ts:17-18)

FOREGROUND          → setNotificationHandler decides
   committed (HEAD): remote pushes suppressed, local alerts shown
                     (handler read trigger.type === 'push' → shouldShow* = false)
   WORKING TREE:     every notification shown — banner + list + sound, unconditionally
                     (lib/useStaffAlerts.ts:19-26)
```

Independently of the push path, a foreground WS event posts a **local** notification:
`useStaffAlerts` subscribes via `useStaffRealtime` and, gated on `AppState.currentState
=== 'active'` (`useStaffAlerts.ts:74`) and the persisted `staff_alerts_enabled` preference
(`:71`), calls `scheduleNotificationAsync` with copy from `messageFor(ev)`
(`:77-81`). Copy is centralized in `lib/alertMessages.ts:28-48`.

### Android channels — there are two

| Channel id | Created by | Settings |
|---|---|---|
| `staff-orders` | `push.ts:23`, `:36-43` | MAX importance, PUBLIC lockscreen, sound, vibration `[300,500]` — must match `push_service._ANDROID_CHANNEL` on the backend (`push.ts:21-22`) |
| `staff-v2` | `useStaffAlerts.ts:14`, `:49-54` | MAX importance, PUBLIC lockscreen, sound — target of local WS alerts (`:81`) |

The `-v2` suffix exists because Android channel settings are immutable after first
creation, so new settings require a new id (`useStaffAlerts.ts:12-13`).

### Firebase files

| File | Purpose | Tracked? |
|---|---|---|
| `google-services.json` | App-side **public** Firebase config. `project_id: reva-tap`, `project_number: 1066669236604`, `package_name: com.reva.revamobile` — matches `app.json:21`. Referenced by `app.json:22` (`android.googleServicesFile`). | **gitignored** (`.gitignore` bottom) but deliberately **not** in `.easignore`, so EAS uploads it — that is the entire reason `.easignore` exists (`.easignore` header + closing NOTE) |
| `fcm-key.json` | Firebase **service-account private key** (`type`, `private_key`, `client_email`, …; `project_id: reva-tap`) — the server-side FCM v1 credential, uploaded once to Expo. | gitignored **and** `.easignore`d — never uploaded to build servers |
| `credentials/android/` | Android signing material | `.easignore`d (`credentials/`) |

---

## 6. Core screen workflows

### 6.1 Kitchen — `screens/kitchen/KitchenScreen.tsx`

Query `useGetKitchenQueueQuery()` → `GET /kitchen/queue` (`kitchenApi.ts:42`), **no
polling interval** — refresh comes only from WS events (`KitchenScreen.tsx:35`) and
pull-to-refresh (`:121`).

Statuses driving the UI: `NEW` → "Start preparing" (`:87`), `PREPARING` → "Mark ready"
(`:96`), "Cancel" always rendered (`:107`). *Claim from a source comment, unverified
against the backend:* the queue endpoint returns only NEW/PREPARING items
(`kitchenApi.ts:27-28`).

```
NEW ──"Start preparing"──> POST /kitchen/items/{id}/preparing ──> PREPARING
                             optimistic: STATUS-FLIP (card stays, button changes)
                             kitchenApi.ts:18-23 → wired :52 ; rollback :56

PREPARING ──"Mark ready"──> POST /kitchen/items/{id}/ready ──> READY (leaves queue)
                             optimistic: REMOVE from cached list
                             kitchenApi.ts:30-34 → wired :65 ; rollback :69

any ──"Cancel"──> POST /kitchen/items/{id}/cancel
                    NO optimistic patch, NO error surface (kitchenApi.ts:73-77,
                    KitchenScreen.tsx:107)
```

Per-card busy state: `pendingIds: ReadonlySet<string>` (`:30`) drives `loading` on the
tapped button only, so other cards stay tappable (`:91`, `:101`). `runItemAction()`
(`:44-64`) awaits `.unwrap()` and on failure raises
`Alert.alert(title, errDetail(e) + "The item was NOT updated — please try again.")`
(`:54`) — the stated rule being that a silently reverted "done" must never pass for a done
item (`:41-43`).

### 6.2 Waiter

**Serve — `screens/waiter/WaiterReadyScreen.tsx`**

`GET /waiter/ready` (`waiterApi.ts:54`), no polling; refetches on
`order_item.status_changed` / `order.created` / `order.approval_decided` (`:53-57`).

```
tap "Mark served" → optimistic REMOVE (waiterApi.ts:26-30, wired :76)
                  → POST /waiter/items/{id}/served (waiterApi.ts:72)
                  ├─ ok   → invalidatesTags 'WaiterQueue' → refetch (server truth)
                  └─ fail → patch.undo() (:80) → card returns → Alert
                            "Could not mark served … NOT updated" (screen :35-38)
```

Per-item `pendingIds` set (`:25`, `:91`). Screen docstring: the queue holds every
approved, unserved item (NEW/PREPARING/READY) because KOT-driven kitchens never mark items
ready (`:14-18`) — a source-comment claim about backend behavior, unverified here.

**Approve / reject — `screens/waiter/WaiterOrdersScreen.tsx`**

Two queries, both `pollingInterval: 15_000` (`:37-38`): `GET /waiter/pending-approvals`
(`waiterApi.ts:60`) and `GET /waiter/open-orders` (`waiterApi.ts:65`). Pending items are
grouped by `order_id` into one card per order batch (`:85-101`). Both refetch on six event
types (`:27-34`, handler `:76-79`).

```
tap Approve → optimistic REMOVE of the whole batch card
              removePendingOrder(orderId) filters getPendingApprovals by order_id
              waiterApi.ts:32-36 → wired :110
            → POST /waiter/orders/{id}/approve                waiterApi.ts:105
            ├─ ok   → invalidates 'WaiterOpenOrders','WaiterPending'
            └─ fail → patch.undo() (:114) → Alert "Approval failed" (screen :58-61)

tap Reject  → same removal (wired :128, rollback :132)
            → POST /waiter/orders/{id}/reject
              body {reason} only when a reason is present, else {} (waiterApi.ts:121-123)

"Move to billing" → POST /waiter/orders/{id}/meal-finished    waiterApi.ts:86
              enabled only when o.bill_requested (screen :194)
              NO optimistic patch, NO error surface
```

Busy state is `pendingByOrder: ReadonlyMap<string,'approve'|'reject'>` (`:45`): the tapped
button shows a spinner while its sibling is `disabled`, so a single order cannot receive
both decisions (`:145-147`, `:154-156`).

**Calls — `screens/waiter/WaiterCallsScreen.tsx`**

`GET /waiter/calls` @ 15 s (`:30-32`) + `POST /waiter/calls/{id}/attend`
(`waiterApi.ts:49`). Refetches on `waiter.called` / `waiter.call_attended` (`:38`). Still
uses the **old global** `disabled={busy}` pattern (`:33`, `:64`) — not converted to
per-item state, no optimistic patch, no failure Alert.

### 6.3 Counter / billing — `screens/billing/BillingView.tsx`

One implementation shared by two surfaces: `CounterBillingScreen.tsx:9` and
`WaiterBillingScreen.tsx:42`. The waiter copy is gated on `GET /waiter/billing-enabled`
(`waiterApi.ts:69`) and renders a "Billing not enabled" wall when disabled
(`WaiterBillingScreen.tsx:26-38`); the source notes the backend is the real enforcement
and a hidden button is never authorization (`:10-13`).

```
OrdersView (BillingView.tsx:53)
  GET /counter/open-orders  @15s (:54)      GET /counter/orders @15s (:55)
  refetch on order.created | order.status_changed | order.closed | bill.requested (:77-85)

  Open table, bill NOT requested
      ├─ "Start billing"   → POST /counter/orders/{id}/start-billing   counterApi.ts:64
      └─ "Close"           → POST /counter/orders/{id}/close-unpaid {reason}  :71
  Open table, bill requested
      ├─ "Bill & clear"    → MethodModal → POST /counter/orders/{id}/quick-bill
      │                      {method} + Idempotency-Key   counterApi.ts:85-88
      │                      key minted per attempt, reused on retry (BillingView.tsx:115)
      └─ "Move to billing" → POST /counter/orders/{id}/meal-finished   counterApi.ts:46

  Ready-for-billing queue
      select row + discount (flat | percent, validated :98)
      → POST /invoices {order_id, discount_type, discount_value}   counterApi.ts:93
      → onInvoice(inv.id) → InvoiceView
      row actions: "Reopen" → POST /counter/orders/{id}/reopen {reason}  counterApi.ts:56
                   "Close"  → POST /counter/orders/{id}/close-unpaid {reason}

InvoiceView (BillingView.tsx:376)
  GET /invoices/{id}  pollingInterval 10_000 (:385-387)
  refetch on invoice.paid | order.closed (:400)
  PAID    → "✓ Payment recorded" (:443-446)
  VOID/REFUNDED → closed notice (:447-450)
  else    → method chips CASH|CARD|COUNTER_WALLET (:30, :455)
            "Collect <total>" → POST /invoices/{id}/pay {method} + Idempotency-Key
                                counterApi.ts:114-118 (key stable per view, :395)
            role === 'ADMIN'  → "Manual override" → POST /invoices/{id}/override {reason}
                                counterApi.ts:130 (BillingView.tsx:469-478, :491)
```

No optimistic patches anywhere in billing — every mutation relies on `invalidatesTags`.
Printing is intentionally omitted on mobile, handled by the KOT/print worker
(`BillingView.tsx:40`). Currency is hardcoded `NPR` (`BillingView.tsx:29`).

### 6.4 Counter display — `screens/counter/CounterDisplayScreen.tsx`

Read-only wall board. `GET /counter-display/board` @ 15 s (`:12-14`), refetch on
`order.created` / `order_item.status_changed` (`:19`). No mutations.

---

## 7. Local state & caching

### Store

`store/store.ts:12-33` — plain `configureStore`, **no persistence layer**. Two hand-written
slices (`auth`, `ui`) plus seven RTK Query reducers/middleware. Everything except the two
`AsyncStorage` keys in §2 is lost on cold start; session continuity comes from the native
cookie jar, not from redux.

### Tags and invalidation

| Slice | Tags | Providers → invalidators |
|---|---|---|
| `kitchenApi` | `KitchenQueue` | provided by `getKitchenQueue` (:45); invalidated by all three mutations (:50, :63, :76) |
| `waiterApi` | `WaiterQueue`, `WaiterOpenOrders`, `WaiterPending`, `WaiterCalls` (:41) | `getWaiterCalls`→`WaiterCalls` (:46), `getReadyItems`→`WaiterQueue` (:57), `getPendingApprovals`→`WaiterPending` (:62), `getOpenOrders`→`WaiterOpenOrders` (:66); `markServed`→`WaiterQueue` (:74), `attend`→`WaiterCalls` (:51), `mealFinished`→`WaiterOpenOrders` (:91), `reopen`→`WaiterOpenOrders`+`WaiterQueue` (:100), `approve`/`reject`→`WaiterOpenOrders`+`WaiterPending` (:108, :126) |
| `counterApi` | `CounterInvoice`, `CounterOrders`, `CounterOpenOrders` (:28) | see `counterApi.ts:32-135` |
| `counterDisplayApi` | `DisplayBoard` (:10) | provided by `getBoard` (:15); **never invalidated by anything** |
| `authApi` | none | — |

`getOpenOrders` (`waiterApi.ts:64-67`) and both counter order queries
(`counterApi.ts:30-37`) have **no `transformResponse`** — `CounterOrderSummary` is a
compile-time type only, never validated at runtime, unlike every queue endpoint.

### Polling intervals

| Screen / query | Interval | Citation |
|---|---|---|
| Kitchen queue | **none** | `KitchenScreen.tsx:23` |
| Waiter Serve (`/waiter/ready`) | **none** | `WaiterReadyScreen.tsx:20` |
| Waiter Calls | 15 s | `WaiterCallsScreen.tsx:31` |
| Waiter Orders (pending + open) | 15 s each | `WaiterOrdersScreen.tsx:37-38` |
| Billing open-orders + queue | 15 s each | `BillingView.tsx:54-55` |
| Invoice detail | 10 s | `BillingView.tsx:386` |
| Counter display board | 15 s | `CounterDisplayScreen.tsx:13` |

### How WS interacts with the cache

**WS messages trigger `refetch()`; they never patch the cache.** Every screen handler
compares `ev.type` against a local set and calls `refetch()` on the query hooks
(`KitchenScreen.tsx:35`, `WaiterOrdersScreen.tsx:76-79`, `WaiterReadyScreen.tsx:53-58`,
`WaiterCallsScreen.tsx:38`, `CounterDisplayScreen.tsx:19`, `BillingView.tsx:77-86`,
`:400`). No handler reads the event payload — the event is used purely as a "something
changed" signal.

Direct cache patching happens in exactly one place: the optimistic `updateQueryData`
patches on mutation start (`kitchenApi.ts:18`, `:30`; `waiterApi.ts:26`, `:32`), which are
local and rolled back with `patch.undo()` on failure.

Reconciliation order for a mutation:

```
tap → updateQueryData patch (local, instant)
    → HTTP request
    → success: invalidatesTags → refetch → server payload replaces the patched cache
    → failure: patch.undo() → pre-tap cache restored → Alert
```

---

## 8. Build & config

### `eas.json`

| Profile | `EXPO_PUBLIC_API_BASE_URL` | Android build | Other |
|---|---|---|---|
| `development` | **unset** → falls back to `http://10.0.2.2:8000` (`lib/config.ts:15`) | — | `developmentClient: true`, `distribution: internal` (:7-10) |
| `preview` | `https://revatap.com` (:17) | `buildType: apk` (:14) | `distribution: internal` (:12) |
| `production` | `https://revatap.com` (:26) | `buildType: apk` (:23) | `autoIncrement: true` (:21) |

`cli.appVersionSource: "remote"` (:4). `submit.production` is empty (:31). The production
profile builds a sideloadable APK rather than an app bundle — commit `1adeaee`.

### `app.json`

| Key | Value | Line |
|---|---|---|
| `name` / `slug` | `reva-mobile` | :3-4 |
| `version` | `1.0.0` | :5 |
| `android.package` | `com.reva.revamobile` | :21 |
| `android.googleServicesFile` | `./google-services.json` | :22 |
| `android.usesCleartextTraffic` | `true` | :20 |
| `plugins` | `["expo-secure-store"]` | :27-29 |
| `owner` | `ank.ofc` | :30 |
| `extra.eas.projectId` | `9b615b58-fa61-4167-8fbd-0ab45d633e18` | :33 |

There is **no `notification` block** in `app.json`; all notification configuration is
runtime code (`push.ts:34-44`, `useStaffAlerts.ts:19-26`, `:49-54`).

### Env injection at build time

Expo inlines any `EXPO_PUBLIC_*` variable into the JS bundle at build time
(`lib/config.ts:4-6`). The value therefore comes from the `env` block of whichever EAS
profile is built; there is no runtime configuration path. `.env.example` documents the
local choices (emulator `10.0.2.2:8000`, simulator `localhost:8000`, LAN
`<PC-LAN-IP>:8000`, production `https://<your-domain>`). `.env` is gitignored **and**
`.easignore`d.

Toolchain: Expo `~57.0.4`, React Native `0.86.0`, React `19.2.3`, RTK `^2.12.0`,
axios `^1.18.1`, zod `^3.25.76` (`package.json:5-25`). Scripts: `start`, `android`, `ios`,
`web`, `test` (jest), `typecheck` (`package.json:33-40`).

---

## 9. Uncommitted work audit

```
$ git status
On branch master — up to date with 'origin/master'.
Changes not staged for commit:
	modified:   src/features/kitchen/kitchenApi.ts
	modified:   src/features/waiter/waiterApi.ts
	modified:   src/lib/useStaffAlerts.ts
	modified:   src/screens/kitchen/KitchenScreen.tsx
	modified:   src/screens/waiter/WaiterOrdersScreen.tsx
	modified:   src/screens/waiter/WaiterReadyScreen.tsx

$ git log --oneline -8
1adeaee chore: production profile builds sideload APK instead of app-bundle
4acf211 fix: add .easignore so gitignored google-services.json uploads to EAS;
        staff-orders channel MAX importance
54766ea chore: migrate to ank.ofc EAS project (owner + projectId), ignore secret files
e68d1af chore: add firebase google-services.json for FCM v1
d6d7745 Merge pull request #1 from StormDraco/fix/ws-ticket-auth
9bbb852 fix: adopt single-use WS tickets (backend auth cutover)
1a01a35 Set the API base URL for EAS cloud builds
a9293b9 Wire up Expo push: Firebase config, EAS project, secret ignores

$ git diff --stat
 src/features/kitchen/kitchenApi.ts        | 46 +++++++++++++++-
 src/features/waiter/waiterApi.ts          | 43 ++++++++++++++
 src/lib/useStaffAlerts.ts                 | 24 ++++-------
 src/screens/kitchen/KitchenScreen.tsx     | 50 ++++++++++++++---
 src/screens/waiter/WaiterOrdersScreen.tsx | 50 ++++++++++++++---
 src/screens/waiter/WaiterReadyScreen.tsx  | 41 ++++++++++---
 6 files changed, 216 insertions(+), 38 deletions(-)
```

### Per-file change summary

| File | Change |
|---|---|
| `src/features/kitchen/kitchenApi.ts` | Adds `optimisticStatus()` (:18-23) and `optimisticRemove()` (:30-34); wires `onQueryStarted` into `markPreparing` (status-flip, :51-58) and `markReady` (remove, :64-71), both rolling back with `patch.undo()`. `cancelItem` deliberately untouched. Imports `OrderItemStatus`. |
| `src/features/waiter/waiterApi.ts` | Adds `removeReadyItem()` (:26-30) and `removePendingOrder()` (:32-36); wires optimistic-remove + rollback into `markServed` (:75-82), `approveOrderItems` (:109-116), `rejectOrderItems` (:127-134). |
| `src/lib/useStaffAlerts.ts` | **Reverses foreground push suppression.** The old handler inspected `notification.request.trigger.type === 'push'` and returned `shouldShowBanner/List/Sound: false` for remote pushes; the new one returns `true` unconditionally (:19-26). Comment rewritten (:16-18). |
| `src/screens/kitchen/KitchenScreen.tsx` | Removes global `busy = preparingBusy \|\| readyBusy`; adds `pendingIds` Set (:30) and `runItemAction()` (:44-64) which `.unwrap()`s and raises a failure `Alert` (:54). Buttons move from `disabled={busy}` to `loading={pendingIds.has(item.id)}` (:91, :101). |
| `src/screens/waiter/WaiterOrdersScreen.tsx` | Removes global `busy`; adds `pendingByOrder` Map (:45) and `decide()` (:52-71) with `.unwrap()` + action-specific `Alert` (:58-61). Approve/Reject get per-order `loading` plus mutual `disabled` (:145-147, :154-156). |
| `src/screens/waiter/WaiterReadyScreen.tsx` | Removes global `busy`; adds `pendingIds` Set (:25) and `serve()` (:29-48) with `.unwrap()` + failure `Alert` (:35-38); per-card `loading` (:91). |

### Branches

```
$ git branch -vv
  fix/ws-ticket-auth 9bbb852 [origin/fix/ws-ticket-auth] fix: adopt single-use WS tickets
* master             1adeaee [origin/master] chore: production profile builds sideload APK

$ git branch -a --merged master     →  fix/ws-ticket-auth, master,
                                       origin/fix/ws-ticket-auth, origin/master,
                                       origin/table-notify
$ git branch -a --no-merged master  →  origin/stable-1.0

$ git for-each-ref --sort=-committerdate refs/remotes
origin/master             2026-07-18
origin/fix/ws-ticket-auth 2026-07-18
origin/stable-1.0         2026-07-16
origin/table-notify       2026-07-10
```

| Branch | State | Assessment |
|---|---|---|
| `master` | tip `1adeaee`, local == remote | current |
| `fix/ws-ticket-auth` | merged via PR #1 (`d6d7745`) | **stale** — content is on master; local + remote copies deletable |
| `origin/table-notify` | merged into master, oldest (2026-07-10) | **stale**, deletable |
| `origin/stable-1.0` | **not merged**, `37c9e90 "stuff like icon"` (2026-07-16) | only branch with commits absent from master. Name suggests a release pin rather than pending work — **unverified** |

**Shipped vs pending:** everything through `1adeaee` is on `origin/master` — WS ticket
cutover, FCM wiring, ank.ofc EAS migration, `.easignore`, APK production profile. The
six-file optimistic-update work and the foreground-push un-suppression are **uncommitted
and present in no build**.

---

## 10. Open questions & risks

Flagged only — nothing here was changed.

### R1 — One WebSocket per `useStaffRealtime()` call site, not one per app
`useRealtime.ts:25` constructs a **new** `ReconnectingWs` inside every hook invocation.
`useStaffAlerts()` mounts one (`useStaffAlerts.ts:69` via `AppNavigator.tsx:154`) and each
mounted screen mounts another. On the waiter surface (bottom tabs stay mounted once
visited) that is up to **five concurrent staff sockets**, each independently
`POST /auth/ws-ticket` (`ws.ts:53`) and each pinging every 20 s (`ws.ts:42`). Multiplies
ticket-endpoint load and connection count per device.

### R2 — Foreground duplicate notifications (the WS-vs-push overlap)
With the working-tree change, the foreground handler shows **every** notification
including remote pushes (`useStaffAlerts.ts:19-26`), while the WS handler independently
posts a local notification for the same event when `AppState` is `active`
(`useStaffAlerts.ts:74-81`). A single backend event that is both broadcast over WS and
pushed will therefore surface **twice** in the foreground — exactly what the reverted
suppression prevented. The AppState guard only prevents WS alerts in the background; it
does nothing about push-vs-WS in the foreground.

### R3 — Two Android channels, only one matching the backend
`push.ts:23` creates `staff-orders` (asserted to match `push_service._ANDROID_CHANNEL`,
`push.ts:21-22`); `useStaffAlerts.ts:14` creates `staff-v2` for local alerts. Users see two
entries in Android notification settings and can silence one without the other. Whether
the backend still sends `staff-orders` is **not verifiable from this repo**.

### R4 — Expo push tokens are EAS-project-scoped (the multi-phone token issue)
`getExpoPushTokenAsync({projectId})` mints a token bound to
`extra.eas.projectId = 9b615b58-…` under owner `ank.ofc` (`app.json:30-34`, `push.ts:62-65`).
Any device still running an APK built under the **previous** EAS project holds a token
bound to that old project; the backend cannot deliver to it with the current credentials,
and the client will never notice — `registerForPush` swallows every failure
(`push.ts:73-75`) and there is no token-refresh or re-registration path beyond the single
mount effect (`useStaffAlerts.ts:62`). Phones must be reinstalled from a current build.

### R5 — Push registration has no observability and no retry
`push.ts:73-75` catches everything; `:59` returns silently on denied permission; `:63`
returns silently when no `projectId`; `:66` returns silently on an empty token. A device
that never registers is indistinguishable from one that did. `registerForPush()` runs
exactly once per mount of `useStaffAlerts` (`useStaffAlerts.ts:62`) — no retry on
transient network failure.

### R6 — No notification-response handler
Nothing in `src/` calls `addNotificationResponseReceivedListener` or
`getLastNotificationResponseAsync` (grep over `src/`: no matches). Tapping a push opens
the app to whatever screen the role lands on — no deep link to the order, table, or
call that triggered it.

### R7 — Polling can resurrect an optimistically removed card
`WaiterOrdersScreen.tsx:37-38` polls both queues at 15 s. A poll that completes between the
optimistic `updateQueryData` removal (`waiterApi.ts:110`) and the server commit replaces
the cache with a server payload that still contains the item, making the card reappear and
then vanish. Same exposure on the 15 s billing queries (`BillingView.tsx:54-55`). Not
observed — flagged as a race the current design permits.

### R8 — Kitchen and Serve have no polling fallback
`KitchenScreen.tsx:23` and `WaiterReadyScreen.tsx:20` pass no `pollingInterval`. If the WS
goes fatal (two consecutive 1008s, `ws.ts:120-126`), these two screens stop updating
entirely until a manual pull-to-refresh or a banner tap. The banner does surface the state
(`RealtimeBanner.tsx:18`), but the busiest two screens are the ones with no automatic
fallback.

### R9 — Fire-and-forget mutations with no error surface
- `cancelItem` — `KitchenScreen.tsx:107`, no `.unwrap()`, no Alert, no optimistic patch
- `markMealFinished` — `WaiterOrdersScreen.tsx:195` and `BillingView.tsx:190`
- `startBilling` — `BillingView.tsx:179`
- `attendWaiterCall` — `WaiterCallsScreen.tsx:65`

A failed request here is invisible to the user; the row simply doesn't move. The
optimistic-update work fixed this pattern for five mutations and left these four.

### R10 — Declared-but-unused config and dependencies
- `expo-secure-store` is a dependency (`package.json:17`) **and** an Expo plugin
  (`app.json:28`) but is imported nowhere in `src/` — dead config that still adds a native
  module to every build. Note the access token is explicitly in-memory by design
  (`services/api.ts:5-6`), so this is leftover, not a missing wiring.
- `expo-image-picker` (`package.json:15`) — used only for the admin product-image upload
  path (`adminApi.ts:125`); confirm before pruning.
- `expo-constants` is imported by `push.ts:16` and `notifications.ts:14` but is **not** a
  declared dependency in `package.json` — it resolves transitively through `expo`.

### R11 — Exported-but-unused endpoints
`usePrintKotMutation` (`counterApi.ts:41`, `:142`), `useGetPrintConfigQuery`
(`counterApi.ts:107`, `:151`), `useLazyGetReceiptQuery` (`counterApi.ts:103`, `:150`), and
`useGetMeQuery` (`authApi.ts:27`, `:75`) are exported from their slices but referenced by
no screen. `GET /auth/me` in particular is never called — role comes exclusively from the
JWT payload (`authApi.ts:64-71`), so a role changed server-side is not picked up until the
next token refresh.

### R12 — `usesCleartextTraffic: true` in production builds
`app.json:20` enables cleartext HTTP for every build profile, including `production`, which
targets `https://revatap.com` (`eas.json:26`). Needed for the LAN/emulator dev flow
(`lib/config.ts:10-12`), but it also permits a plaintext downgrade in shipped APKs.

### R13 — Runtime validation gaps
`getOpenOrders` (`waiterApi.ts:64-67`), `getCounterOrders` (`counterApi.ts:30-33`) and
`getCounterOpenOrders` (`counterApi.ts:34-37`) have no `transformResponse`, so
`CounterOrderSummary` — including the `bill_requested` boolean that gates "Bill & clear"
and "Move to billing" (`BillingView.tsx:160`, `:189`; `WaiterOrdersScreen.tsx:194`) — is
never validated at runtime, unlike every queue endpoint. A backend field rename would
surface as a silently disabled button, not an error.

### R14 — `DisplayBoard` tag is never invalidated
`counterDisplayApi.ts:15` provides the tag; nothing invalidates it. The board relies
entirely on its 15 s poll and WS-triggered `refetch` (`CounterDisplayScreen.tsx:19`).
Harmless today — the screen is read-only — but the tag is decorative.

### R15 — Endpoints to cross-check against the backend's `ARCHITECTURE.md`
Every path in §3 is a client-side claim. The ones worth verifying first, because a
mismatch is silent or user-visible-but-misleading:
`POST /auth/ws-ticket`, `POST /push/register`, `POST /push/unregister`,
`GET /waiter/billing-enabled`, `POST /counter/orders/{id}/quick-bill`,
`POST /counter/orders/{id}/print-kot`, `GET /counter/print-config`,
`GET /invoices/{id}/receipt`, `GET /auth/me`, and
`POST /admin/settings/kot-worker-token`. Also worth confirming from the backend side:
whether `/kitchen/queue` really returns only NEW/PREPARING (assumed by the optimistic
remove, `kitchenApi.ts:27-28`) and whether `/waiter/ready` really includes NEW/PREPARING
as well as READY (assumed by `WaiterReadyScreen.tsx:15-18`). Both optimistic patches
depend on those response contracts being exactly as the comments describe.
