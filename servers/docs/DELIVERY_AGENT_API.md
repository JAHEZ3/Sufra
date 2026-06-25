# Delivery Agent — Mobile API & Screen Guide

Reference for developers working on the **delivery-agent** half of the JAHAZ mobile app. Covers every screen in the agent flow, every endpoint the app talks to, the WebSocket events it emits & receives, and the auth + token-rotation rules.

> The delivery agent has its **own** auth stream — separate phone, OTP, password, and token pair from the customer auth. Both halves can live in the same APK/IPA but they never share tokens.

---

## 1. Service topology

| Service          | Port | Base path              | Used for                                                                       |
|------------------|------|------------------------|--------------------------------------------------------------------------------|
| Auth Service     | 3004 | `/api/auth`            | Phone register, OTP verify, login, password change, refresh, sessions          |
| **Delivery**     | 3002 | `/api/delivery`        | Agent profile, application Q&A, live location push, agent lookup               |
| Order Service    | 3001 | `/api/order`           | Read assigned orders, transition status, chat, fetch receipts                  |
| API Gateway (WS) | 3000 | `socket.io`            | Real-time `order:new` pings, location broadcasts to order rooms                |

Mobile env vars (`.env` at `app/mobile/`):

```
EXPO_PUBLIC_API_URL_AUTH=http://<host>:3004
EXPO_PUBLIC_API_URL_DELIVERY=http://<host>:3002
EXPO_PUBLIC_API_URL_ORDER=http://<host>:3001       # optional — used for order CRUD
EXPO_PUBLIC_WS_URL=ws://<host>:3000
```

Tokens are persisted with `expo-secure-store`. The customer + delivery key pairs are stored under different keys:
- Customer: `refreshToken`
- Delivery: `deliveryRefreshToken`

`deliveryApi` in [lib/api.ts](../../mobile/lib/api.ts) implements **silent refresh with a pending queue**: when a 401 arrives, the first failing request triggers a refresh; concurrent requests are paused and replayed once the new token is in.

---

## 2. Agent statuses (the state the app navigates around)

```ts
type DeliveryAgentStatus =
  | 'SUSPENDED'         // post-OTP, profile not submitted
  | 'PENDING_APPROVAL'  // application submitted, awaiting manager review
  | 'ACTIVE'            // approved → can take orders
  | 'REJECTED';         // manager rejected
```

The mobile cache the status in `SecureStore` under `deliveryAgentStatus` and reads it on app boot **before** the refresh HTTP call finishes — so the guard at `app/delivery/index.tsx` can route instantly. See [useDeliveryInit.ts](../../mobile/hooks/useDeliveryInit.ts).

---

## 3. Screen map

| Screen file                                                                                                       | Route                       | What it does                                                                                                   |
|-------------------------------------------------------------------------------------------------------------------|-----------------------------|----------------------------------------------------------------------------------------------------------------|
| [DeliveryRegisterScreen.tsx](../../mobile/modules/delivery/screens/DeliveryRegisterScreen.tsx)                     | `/delivery/register`        | Phone number entry → triggers OTP                                                                              |
| [DeliveryOTPScreen.tsx](../../mobile/modules/delivery/screens/DeliveryOTPScreen.tsx)                               | `/delivery/otp`             | 6-digit OTP → receives token pair                                                                              |
| [DeliveryApplicationScreen.tsx](../../mobile/modules/delivery/screens/DeliveryApplicationScreen.tsx)               | `/delivery/application`     | 3-step wizard: personal · vehicle/payment · documents/answers/password                                         |
| [DeliveryPendingScreen.tsx](../../mobile/modules/delivery/screens/DeliveryPendingScreen.tsx)                       | `/delivery/pending`         | Static "awaiting approval" screen                                                                              |
| [DeliveryRejectedScreen.tsx](../../mobile/modules/delivery/screens/DeliveryRejectedScreen.tsx)                     | `/delivery/rejected`        | Application rejected — read-only reason                                                                        |
| [DeliveryDashboardScreen.tsx](../../mobile/modules/delivery/screens/DeliveryDashboardScreen.tsx)                   | `/delivery/dashboard`       | Active agent home — incoming orders, current trip, location push toggle                                        |
| [delivery/index.tsx](../../mobile/app/delivery/index.tsx)                                                          | `/delivery`                 | Guard — reads `lastKnownStatus` and redirects to the right screen                                              |

### Navigation flow

```
delivery/register
   ↓ (POST /auth/delivery/register → otp sent)
delivery/otp
   ↓ (POST /auth/verify-otp → tokens, status = SUSPENDED)
delivery/application
   ↓ (POST /api/delivery/profile multipart → status = PENDING_APPROVAL)
delivery/pending   ←——————————————————————————————————————(awaiting)
   ↓ manager approves                ↓ manager rejects
delivery/dashboard                  delivery/rejected
```

`gestureEnabled: false` is set on every one-way step (OTP, application steps, dashboard) so the back gesture can't break the flow.

---

## 4. Authentication endpoints

All under `/api/auth`. None are role-guarded; the OTP flow itself is the auth.

| Verb | Path                              | Body                                  | Returns                                          |
|------|-----------------------------------|---------------------------------------|--------------------------------------------------|
| POST | `/api/auth/delivery/register`     | `{ phone }`                           | `{ userId }` + sends OTP via SMS                 |
| POST | `/api/auth/verify-otp`            | `{ userId, code }`                    | `{ accessToken, refreshToken, user }`            |
| POST | `/api/auth/resend-otp`            | `{ userId }`                          | OK                                                |
| POST | `/api/auth/delivery/login`        | `{ phone, password }`                 | `{ accessToken, refreshToken, user }`            |
| POST | `/api/auth/refresh`               | `{ refreshToken }`                    | `{ accessToken, refreshToken }`                  |
| DELETE | `/api/auth/logout`              | `{ refreshToken }`                    | Invalidates current refresh                       |
| POST | `/api/auth/change-password`       | `{ currentPassword, newPassword }`    | OK (auth required)                                |
| POST | `/api/auth/forgot-password`       | `{ phone }`                           | sends reset OTP                                   |
| POST | `/api/auth/reset-password`        | `{ phone, code, newPassword }`        | OK                                                |
| GET  | `/api/auth/sessions`              | —                                     | active sessions for this user                     |
| DELETE | `/api/auth/sessions/:id`        | —                                     | revoke one                                        |
| DELETE | `/api/auth/sessions`            | —                                     | revoke all except current                         |

---

## 5. Delivery-service endpoints (the focus)

All paths below sit under `/api/delivery`.

### 5.1 Public — questionnaire

```http
GET /api/delivery/profile/questions
→ { "data": [{ "question": "..." }, { "question": "..." }, { "question": "..." }] }
```

No auth required. Returns the three honesty questions shown on step 3 of the application wizard. If this endpoint fails or returns empty, the mobile app **uses fallback questions** so the wizard never blocks the applicant.

### 5.2 Read my own profile

```http
GET /api/delivery/profile
Authorization: Bearer <deliveryAccessToken>
```

Returns the agent's full profile + presigned URLs for `profilePictureUrl` and `idPictureUrl`. Includes the `status`, `paymentInfo`, `rating`, `totalDeliveries`, etc.

### 5.3 Submit application (first-time profile completion)

```http
POST /api/delivery/profile
Authorization: Bearer <deliveryAccessToken>
Content-Type: multipart/form-data
```

| Field                    | Type     | Required | Notes                                                                                                       |
|--------------------------|----------|----------|-------------------------------------------------------------------------------------------------------------|
| `firstName`              | text     | yes      |                                                                                                             |
| `lastName`               | text     | yes      |                                                                                                             |
| `dateOfBirth`            | ISO date | yes      | Must be ≥18 years ago.                                                                                       |
| `nationalIdNumber`       | text     | yes      |                                                                                                             |
| `city`                   | text     | yes      |                                                                                                             |
| `vehicleType`            | text     | yes      | `motorcycle` \| `bicycle` \| `car` \| `on_foot`                                                              |
| `vehicleLicenseNumber`   | text     | when car | Required if `vehicleType === 'car'`.                                                                         |
| `emergencyContactName`   | text     | yes      |                                                                                                             |
| `emergencyContactPhone`  | text     | yes      |                                                                                                             |
| `paymentInfo`            | JSON str | yes      | See § 5.3.1 below.                                                                                           |
| `answers`                | JSON str | yes      | `[{ "question": "...", "answer": "..." }, ...]` — one entry per question shown.                              |
| `password`               | text     | yes      | Min 8 chars. Set so the agent can later log in with phone + password.                                        |
| `termsAccepted`          | text     | yes      | `"true"` literal.                                                                                            |
| `profilePicture`         | file     | yes      | JPG/PNG, ≤5 MB.                                                                                              |
| `idPicture`              | file     | yes      | JPG/PNG, ≤5 MB.                                                                                              |

On success the agent status flips to `PENDING_APPROVAL` and a NATS event tells auth-service to do the same. The mobile then routes to `/delivery/pending`.

#### 5.3.1 `paymentInfo` shape

Identical to the restaurant `payment_info` shape so the back-end can store both flavours in one jsonb column. Choose **one** of:

```jsonc
// Bank account
{
  "type": "bank_account",
  "accountHolderName": "اسم صاحب الحساب",
  "bankName":   "Bank of Palestine" | "Palestine Islamic Bank" | "Arab Islamic Bank",
  "accountNumber": "...",
  "iban":          "PS00..."
}

// Wallet
{
  "type": "wallet",
  "accountHolderName": "اسم صاحب الحساب",
  "walletType":    "PalPay" | "Jawwal Pay",
  "accountNumber": "...",
  "phone":         "+970..."
}
```

The mobile picks the brand via the `BrandPicker` component on step 2 of [DeliveryApplicationScreen.tsx](../../mobile/modules/delivery/screens/DeliveryApplicationScreen.tsx).

### 5.4 Live location push (delivery role)

```http
POST /api/delivery/location
Authorization: Bearer <deliveryAccessToken>
{ "lat": 31.5017, "lng": 34.4668, "orderId": "<optional uuid>" }
```

This is the **HTTP fallback** — normally the delivery app pushes location over WebSocket (§ 7) which throttles to 1/3s. Both paths feed the same `delivery_location_logs` table.

### 5.5 Read another agent's last known location

```http
GET /api/delivery/location/:agentId
```

JWT-protected but role-agnostic (manager, restaurant_owner, or assigned customer can call it). Returns `data: null` if the agent hasn't pushed a position in the last hour.

### 5.6 Lists used by other apps

| Endpoint                                                                                | Roles allowed             | Returns                                                                                          |
|-----------------------------------------------------------------------------------------|---------------------------|--------------------------------------------------------------------------------------------------|
| `GET /api/delivery/available`                                                           | manager · restaurant_owner | All active agents enriched with last cached location. Used by the dispatcher. The `id` field is the agent's **auth user_id** (the value written to `order.deliveryAgentId`); the table PK is exposed separately as `agentRecordId`. |
| `GET /api/delivery/open?lat=…&lng=…&city=…`                                             | customer · manager        | Online drivers right now (cached location <5min). Sorts by distance when lat/lng given. PII-stripped (no phone). Same `id` = user_id convention as `/available`. |

#### Driver dashboard feeds (served by the **order-service**, not delivery-service)

The delivery mobile app polls these for its dashboard. They filter on the JWT `sub`,
which equals `order.deliveryAgentId` because the picker assigns the agent's user_id.

| Endpoint                                       | Role     | Returns                                                                 |
|------------------------------------------------|----------|------------------------------------------------------------------------|
| `GET /api/order/orders/delivery/available`     | delivery | Orders assigned to this agent awaiting their accept/reject (`deliveryAcceptance = pending`). |
| `GET /api/order/orders/delivery/active`        | delivery | This agent's current accepted, non-terminal job, or `null`.            |

### 5.7 Manager admin endpoints

These belong to the paneldashboard, not the delivery mobile app — listed here for completeness.

| Verb   | Path                                                | Role     |
|--------|-----------------------------------------------------|----------|
| GET    | `/api/delivery/manager/applications`                | manager  |
| PATCH  | `/api/delivery/manager/applications/:id/approve`    | manager  |
| PATCH  | `/api/delivery/manager/applications/:id/reject`     | manager  |
| GET    | `/api/delivery/manager/agents`                      | manager  |
| GET    | `/api/delivery/manager/agents/:id`                  | manager  |
| PATCH  | `/api/delivery/manager/agents/:id`                  | manager  |
| PATCH  | `/api/delivery/manager/agents/:id/status`           | manager  |
| DELETE | `/api/delivery/manager/agents/:id`                  | manager  |

All `:id` params now use `ParseUUIDPipe`, so a malformed UUID returns a clean 400 instead of crashing TypeORM.

---

## 6. Order-service endpoints relevant to the delivery agent

The delivery app reads its assigned orders from the order-service, not the delivery-service.

| Verb   | Path                                              | Notes                                                                                                |
|--------|---------------------------------------------------|------------------------------------------------------------------------------------------------------|
| GET    | `/api/order/orders`                               | Returns orders where `deliveryAgentId === user.sub`. Same pagination as the customer view.            |
| GET    | `/api/order/orders/:id`                           | Full detail incl. customer drop-off coords + phone.                                                   |
| PATCH  | `/api/order/orders/:id/status`                    | Transition the order: `out_for_delivery` → `delivered`. Status machine enforced server-side.          |
| GET    | `/api/order/orders/:id/chat`                      | Chat history with customer + restaurant.                                                              |
| POST   | `/api/order/orders/:id/chat`                      | Send a chat message.                                                                                  |

### Allowed transitions for the `delivery` role

```
ready_for_pickup  → out_for_delivery   (driver tapped "Picked up")
out_for_delivery  → delivered          (driver tapped "Delivered")
```

Trying to set any other status returns 400. Cancellations stay restaurant/manager-only.

---

## 7. WebSocket — real-time events

### 7.1 Connect (the singleton)

```ts
import { socketService } from '@/socket/socket.service';
// once, after the delivery token is available:
socketService.connect(deliveryAccessToken);
```

The singleton handles reconnect-with-backoff, rejoin of any rooms held in `desiredRooms`, and exposes a typed error pipeline (`useSocketError`). Always call `disconnect()` when the agent signs out.

### 7.2 Events the delivery app **emits**

| Event                       | Payload                                | Throttle             |
|-----------------------------|----------------------------------------|----------------------|
| `delivery:location:update`  | `{ lat, lng, orderId? }`               | Server caps at 1/3s per agent. Excess pings are silently dropped. |
| `order:join`                | `{ orderId }`                          | Required to receive `order:status:updated` and `chat:new` for that order. |
| `order:leave`               | `{ orderId }`                          |                      |

### 7.3 Events the delivery app **receives**

| Event                       | Payload                                                            | When                                                              |
|-----------------------------|--------------------------------------------------------------------|-------------------------------------------------------------------|
| `connected`                 | `{ userId, role }`                                                 | Handshake success                                                 |
| `error`                     | `{ code, message }`                                                | Auth failure / banned account. **Listen for this** — surface it in the UI via `useSocketError()`. |
| `order:new`                 | full order summary                                                 | An order was just assigned to this driver (or to a city pool).    |
| `order:status:updated`      | `{ orderId, status, note? }`                                       | Restaurant transitioned the order (e.g. → `ready_for_pickup`).    |
| `chat:new`                  | `{ id, orderId, senderId, senderRole, content, createdAt }`        | Customer or restaurant sent a chat message                        |

### 7.4 Location push pattern (recommended)

```ts
// 1. ask for foreground permission
const { granted } = await Location.requestForegroundPermissionsAsync();
if (!granted) return;

// 2. subscribe to position updates
const sub = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
  (loc) => {
    socketService.emit('delivery:location:update', {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      orderId: activeOrderId,    // pass when actively delivering
    });
  },
);

// 3. cancel when leaving the dashboard or going off-duty
return () => sub.remove();
```

Background location is **not** wired today — the agent has to keep the screen on, or the app needs a separate background-location module added (`expo-task-manager` + `expo-location.startLocationUpdatesAsync`). Document this clearly in your app-store privacy strings before shipping.

---

## 8. End-to-end agent happy path

```
1. POST /api/auth/delivery/register            { phone }            → OTP sent
2. POST /api/auth/verify-otp                   { userId, code }     → tokens, status=SUSPENDED
3. GET  /api/delivery/profile/questions                            → 3 questions to show in step 3
4. POST /api/delivery/profile                  (multipart)          → status=PENDING_APPROVAL
5. (Mobile polls or just navigates to /pending; status changes via manager action)
6. Manager approves                                                 → status=ACTIVE
7. socketService.connect(deliveryAccessToken)                       → handshake
8. socket.emit('delivery:location:update', { lat, lng })            → every 3s while on-duty
9. socket.on('order:new', …)                                        → render the incoming order card
10. socket.emit('order:join', { orderId: newOrder.id })             → subscribe to that order
11. PATCH /api/order/orders/:id/status         { status:'out_for_delivery' }
12. socket.emit('delivery:location:update', { lat, lng, orderId })  → broadcasts to the order room
13. PATCH /api/order/orders/:id/status         { status:'delivered' }
14. POST /api/auth/logout                      { refreshToken }      → on sign-out
```

---

## 9. Error handling — recommended client logic

| HTTP | Cause                                  | Mobile action                                                                  |
|------|----------------------------------------|--------------------------------------------------------------------------------|
| 400  | Validation failure (e.g. bad UUID)     | Show the server's Arabic `message`. Don't retry.                               |
| 401  | Token expired                          | Silent refresh via `deliveryApi`. On a second 401, force re-login.             |
| 403  | Wrong role / not assigned to the order | "غير مصرح" + navigate back to the dashboard.                                   |
| 404  | Order or application not found         | Refresh the list, then show empty state.                                       |
| 409  | Status conflict (e.g. already delivered) | Surface server `message` and refresh local state.                            |
| 5xx  | Server crash                           | Retry once with backoff, then "حدث خطأ، يرجى المحاولة لاحقاً".                  |

Socket errors land in `useSocketError()` (banner in the dashboard's top safe area). Common values:

- `AUTH_FAILED` → token rejected. Force re-login.
- `ACCOUNT_INACTIVE` → status changed to SUSPENDED/REJECTED. Navigate to `/delivery/index` which the guard re-routes.
- `CONNECT_ERROR` → likely WiFi/cell offline. Tell the agent to check the network; the singleton retries automatically.

---

## 10. Per-screen API call cheat sheet

| Screen                              | Calls on mount                                                              | Calls on action                                                                                |
|-------------------------------------|-----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| `DeliveryRegisterScreen`            | —                                                                            | `POST /api/auth/delivery/register`                                                              |
| `DeliveryOTPScreen`                  | —                                                                            | `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp`                                       |
| `DeliveryApplicationScreen`          | `GET /api/delivery/profile/questions`                                       | `POST /api/delivery/profile` (multipart, finalizes the agent)                                  |
| `DeliveryPendingScreen`              | `GET /api/delivery/profile` (poll on focus)                                  | Tap "logout" → `DELETE /api/auth/logout`                                                       |
| `DeliveryRejectedScreen`             | `GET /api/delivery/profile`                                                  | —                                                                                              |
| `DeliveryDashboardScreen`            | `GET /api/order/orders?kind=online&status=ready_for_pickup`, socket connect | `PATCH /api/order/orders/:id/status`, `socket.emit('delivery:location:update', …)`, `socket.emit('order:join'/'order:leave', …)` |

---

## 11. App Store / Play Store checklist

- [ ] **Tokens** stored only in `SecureStore` — never in plain `AsyncStorage`.
- [ ] **Silent refresh** tested under network loss + concurrent 401s on `deliveryApi`.
- [ ] **Phone-OTP register/login** tested with a stale OTP (server returns 400, mobile shows Arabic message).
- [ ] **Application multipart upload** tested on slow 3G — `axios` `timeout` should be ≥30s for this single call (image upload).
- [ ] **Location permission** privacy strings filled in (`ios.infoPlist.NSLocationWhenInUseUsageDescription`, `android.permissions.ACCESS_FINE_LOCATION`).
- [ ] **Socket reconnect** rejoins all active order rooms — verify by killing the gateway mid-delivery and watching the dashboard re-establish.
- [ ] **`useSocketError` banner** verified by forcing an `AUTH_FAILED` (e.g. set `deliveryAccessToken` to a corrupted string).
- [ ] **Production base URLs** set via build flavour (no LAN IP / `localhost` in the release build).
- [ ] **Arabic `Accept-Language: ar`** header set so server-side messages render in Arabic.

---

## 12. Source-of-truth file pointers

| Concern                       | File                                                                                                |
|-------------------------------|-----------------------------------------------------------------------------------------------------|
| Controller (all endpoints)    | [delivery-service.controller.ts](../apps/delivery-service/src/delivery-service.controller.ts)        |
| Service (business logic)      | [delivery-service.service.ts](../apps/delivery-service/src/delivery-service.service.ts)              |
| Application DTO               | [complete-profile.dto.ts](../apps/delivery-service/src/dto/complete-profile.dto.ts)                 |
| Agent entity                  | [delivery-agent.entity.ts](../apps/delivery-service/src/entities/delivery-agent.entity.ts)          |
| Location log entity           | [delivery-location-log.entity.ts](../apps/delivery-service/src/entities/delivery-location-log.entity.ts) |
| Gateway WS source             | [socket.gateway.ts](../apps/api-gateway/src/gateway/socket.gateway.ts)                               |
| Mobile socket client          | [socket.service.ts](../../mobile/socket/socket.service.ts)                                          |
| Mobile delivery hooks         | [modules/delivery/hooks/](../../mobile/modules/delivery/hooks/)                                     |
| Mobile delivery types         | [modules/delivery/types/index.ts](../../mobile/modules/delivery/types/index.ts)                     |
| Mobile auth interceptor       | [lib/api.ts](../../mobile/lib/api.ts) (`deliveryApi`)                                                |
