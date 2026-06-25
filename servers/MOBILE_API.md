# JAHAZ Mobile API — Unified Reference

End-to-end reference for the JAHAZ mobile clients (customer and delivery agent). Covers authentication, profile + addresses, browsing, cart, online checkout, online payment, order tracking (WebSocket), and the per-service base URLs.

> Detailed per-service docs:
> - **Order Service** — [apps/order-service/MOBILE_API.md](apps/order-service/MOBILE_API.md) — cart, checkout, orders, chat, promo (full reference)
> - **Restaurant Service** — [apps/restaurant-service/MOBILE_API.md](apps/restaurant-service/MOBILE_API.md) — browse, menus, tables/QR
>
> This file is the top-level guide that ties them together and adds the auth / customer-profile / delivery-agent endpoints that don't live in either of those.

---

## 1. Service topology

All services run on the same host in dev. In production a single public hostname proxies each prefix to the right port.

| Service              | Port | Base path             | Purpose                                                            |
|----------------------|------|-----------------------|--------------------------------------------------------------------|
| Auth Service         | 3004 | `/api/auth`           | Register, login, OTP, refresh, change-password, sessions           |
| Customer Service     | 3005 | `/api/customer`       | Customer profile (firstName/lastName/location), saved addresses    |
| Restaurant Service   | 3003 | `/api/restaurant`     | List restaurants, menus, public details, table QR scan             |
| **Order Service**    | 3001 | `/api/order`          | Cart, checkout, orders, chat, promo, payment proof                 |
| Delivery Service     | 3002 | `/api/delivery`       | Agent profile/application, **live location push**, agent lookup    |
| API Gateway (WebSocket) | 3000 | `socket.io`        | Real-time order status, delivery location, chat                    |

Environment variables in the mobile app (`app/mobile/.env`):

```
EXPO_PUBLIC_API_URL_AUTH=http://<host>:3004
EXPO_PUBLIC_API_URL_CUSTOMER=http://<host>:3005
EXPO_PUBLIC_API_URL_DELIVERY=http://<host>:3002
EXPO_PUBLIC_WS_URL=ws://<host>:3000
```

Restaurant + Order use the same `<host>` — set their full base URLs the same way if needed.

---

## 2. Authentication

Every protected endpoint requires a Bearer JWT.

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
Accept-Language: ar
```

### 2.1 Customer registration + OTP

```
POST /api/auth/customer/register   body: { phone }                  → { userId }, sends OTP
POST /api/auth/verify-otp          body: { userId, code }           → { accessToken, refreshToken, user }
POST /api/auth/resend-otp          body: { userId }
```

### 2.2 Customer login

```
POST /api/auth/customer/login        body: { phone }                → sends OTP
POST /api/auth/customer/verify-login body: { phone, code }          → { accessToken, refreshToken, user }
```

### 2.3 Delivery agent (separate auth stream — own token pair)

```
POST /api/auth/delivery/register   body: { phone }
POST /api/auth/verify-otp          (same OTP verifier)
POST /api/auth/delivery/login      body: { phone, password }        → tokens
```

### 2.4 Restaurant owner

```
POST /api/auth/restaurant/register
POST /api/auth/restaurant/login    body: { phone, password }
```

### 2.5 Token rotation + logout

```
POST   /api/auth/refresh           body: { refreshToken }           → { accessToken, refreshToken }
DELETE /api/auth/logout            body: { refreshToken }           → invalidates the refresh
GET    /api/auth/sessions          → list active sessions
DELETE /api/auth/sessions/:id      → revoke one session
DELETE /api/auth/sessions          → revoke all sessions except current
```

### 2.6 Password endpoints

```
POST /api/auth/forgot-password     body: { phone }                  → sends reset OTP
POST /api/auth/reset-password      body: { phone, code, newPassword }
POST /api/auth/change-password     body: { currentPassword, newPassword }   (auth required)
```

### 2.7 Client integration pattern

Store both tokens in the device secure storage (Expo SecureStore / Keychain / EncryptedSharedPreferences). On `401`:

1. Call `/api/auth/refresh` once with the stored `refreshToken`.
2. Replay the failed request with the new `accessToken`.
3. If refresh itself fails → force re-login.

Both `customerApi` and `deliveryApi` in [app/mobile/lib/api.ts](../mobile/lib/api.ts) already implement this **silent refresh with a pending queue**: concurrent 401s share a single refresh round-trip.

---

## 3. Response envelope

Every JSON response wraps the payload as:

```json
{
  "data": <T>,
  "message": "string | null"
}
```

Errors follow the standard NestJS shape:

```json
{
  "statusCode": 400,
  "message": "<arabic message>" | ["validation errors..."],
  "error": "Bad Request"
}
```

---

## 4. Customer profile + addresses

Used during the post-OTP profile-completion step and from the "My account" screen.

```
GET    /api/customer/profile                       → full profile (incl. addresses[])
POST   /api/customer/profile                       → first-time completion (multipart, with avatar)
PATCH  /api/customer/profile                       → update profile fields
```

`POST` body fields (multipart/form-data):
```
firstName        (required)
lastName         (required)
dateOfBirth      (ISO date, optional)
locationLat      (required, -90..90)
locationLng      (required, -180..180)
avatar           (file, optional, ≤ 5 MB)
```

### Saved addresses CRUD

```
GET    /api/customer/addresses                     → list (default first)
POST   /api/customer/addresses                     → create
PATCH  /api/customer/addresses/:id                 → update
PATCH  /api/customer/addresses/:id/default         → mark as default
DELETE /api/customer/addresses/:id                 → remove
```

Address body:
```json
{
  "label":  "البيت",           // optional short label
  "street": "شارع الرشيد",
  "city":   "غزة",
  "lat":    31.500,
  "lng":    34.466,
  "isDefault": false            // optional
}
```

The first address created automatically becomes the default. Deleting the default address promotes the next-most-recent.

---

## 5. Browsing & menus (Restaurant Service)

```
GET  /api/restaurant                 → list restaurants (with optional filters)
GET  /api/restaurant/:id             → restaurant detail + menus
GET  /api/restaurant/public/tables/by-qr/:token   → table lookup by QR (table-side ordering)
```

Detailed payloads are in [apps/restaurant-service/MOBILE_API.md](apps/restaurant-service/MOBILE_API.md).

---

## 6. Cart (customer only)

All cart endpoints require `Roles('customer')`.

```
GET    /api/order/cart
POST   /api/order/cart/items                  → { mealId, quantity, options?, notes? }
PATCH  /api/order/cart/items/:mealId          → { quantity?, notes? }
DELETE /api/order/cart/items/:mealId
DELETE /api/order/cart                        → empty the cart
```

Cart is stored in Redis per-customer. Switching to a meal from a different restaurant replaces the cart.

---

## 7. Online checkout

### 7.1 Validate a promo code (optional, before checkout)

```http
POST /api/order/promo/validate
{ "code": "FREESHIP", "orderAmount": 92.5, "restaurantId": "<uuid>" }
→ { "data": { "promoCodeId": "...", "discountAmount": 12.5, "code": "FREESHIP" } }
```

### 7.2 Place the order

```http
POST /api/order/checkout
Authorization: Bearer <accessToken>
Idempotency-Key: <client-generated uuid v4>
Content-Type: application/json

{
  "addressId":      "<customer_address_uuid>",
  "paymentMethod":  "cash_on_delivery" | "card" | "online",
  "promoCode":      "FREESHIP",
  "customerNotes":  "اتركها عند الباب",
  "deliveryFee":    12.5,
  "addressSnapshot": {
    "street": "...",
    "city":   "...",
    "lat":    31.50,
    "lng":    34.47,
    "label":  "البيت"
  },
  "customerName":  "...",
  "customerPhone": "+970...",
  "restaurantName":"..."
}
```

`Idempotency-Key` is **strongly recommended.** If a network timeout causes a retry, the server returns the **same** order (instead of creating a duplicate) and sets `message` to `"تم إرجاع الطلب الموجود"`.

Response:
```json
{
  "data": {
    "id": "...",
    "orderNumber": "ORD-10042",
    "status": "pending",
    "paymentMethod": "online",
    "paymentStatus": "unpaid",
    "totalAmount": 92.5,
    "deliveryAddressSnapshot": { "lat": 31.50, "lng": 34.47, "..." : "..." },
    "items": [...],
    "createdAt": "..."
  },
  "message": "تم إنشاء الطلب بنجاح"
}
```

---

## 8. Online payment (bank-transfer flow)

`paymentMethod: "online"` does **not** integrate a payment gateway. The customer pays via bank transfer / wallet to one of the configured restaurant accounts, then uploads a screenshot.

### 8.1 Upload payment proof

```http
POST /api/order/orders/:id/payment-proof
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <jpg|png, ≤ 5 MB>
```

Stored in S3 under `payment-proofs/<orderId>/...`. The restaurant or admin verifies the screenshot and accepts the order.

### 8.2 Fetch the proof (any participant)

```http
GET /api/order/orders/:id/payment-proof
→ { "data": { "url": "<presigned_s3_url>" } | null }
```

### 8.3 Fetch the invoice/receipt

```http
GET /api/order/orders/:id/receipt
→ { "data": { "url": "<presigned_s3_url>" } | null }
```

---

## 9. Order management

```
GET    /api/order/orders                       → list (paginated, filtered by role)
GET    /api/order/orders/:id                   → details
PATCH  /api/order/orders/:id/status            → restaurant_owner / manager / delivery only
                                                 (delivery: only the assigned + ACCEPTED agent;
                                                  ready_for_pickup → out_for_delivery → delivered)
PATCH  /api/order/orders/:id/delivery          → assign agent (manager / restaurant_owner / customer self-pick)
POST   /api/order/orders/:id/delivery/accept   → driver accepts a pending assignment
POST   /api/order/orders/:id/delivery/reject   → driver declines (clears the assignment)
GET    /api/order/orders/delivery/available    → driver: my pending assignments (accept/reject queue)
GET    /api/order/orders/delivery/active       → driver: my current accepted job (or null)
POST   /api/order/orders/:id/rate              → after delivery (customer)
GET    /api/order/orders/:id/chat              → message history
POST   /api/order/orders/:id/chat              → { content }
```

> The driver-facing list/feed routes filter on the JWT `sub`. That matches
> `order.deliveryAgentId` because the "pick a driver" list returns the agent's
> **user_id** as its `id`, and that's what gets written on assignment.

### Order status flow (`OrderStatus`)

```
pending → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered
                          ↓
                      cancelled  (terminal)
```

The server emits `order:status:updated` over WebSocket on every transition (see § 11).

---

## 10. Delivery agent endpoints

Used by the mobile delivery-agent app (separate token pair from customer auth).

```
GET   /api/delivery/profile/questions          → application questionnaire (3 items)
GET   /api/delivery/profile                    → my agent profile
POST  /api/delivery/profile                    → submit application (multipart, photos + Q&A + paymentInfo)
POST  /api/delivery/location                   → push current GPS (HTTP fallback)
GET   /api/delivery/location/:agentId          → last known location (manager/restaurant_owner)
GET   /api/delivery/available                  → list available agents (dispatcher)
```

Live location is **normally sent over WebSocket** (§ 11) — the HTTP endpoint exists as a fallback when sockets are unavailable.

---

## 11. WebSocket — real-time

Single Socket.IO endpoint at the API gateway (`ws://<host>:3000`).

### 11.1 Connect

```ts
const socket = io(process.env.EXPO_PUBLIC_WS_URL, {
  transports: ['websocket'],
  auth: { token: `Bearer ${accessToken}` },
  reconnection: true,
});
```

JWT is verified once at handshake. Suspended/banned users are rejected with `error: { code: 'ACCOUNT_INACTIVE' }`.

### 11.2 Rooms

| Emit                        | Payload                              | Purpose                                                          |
|-----------------------------|--------------------------------------|------------------------------------------------------------------|
| `order:join`                | `{ orderId }`                        | Subscribe to one order's events. Customer/owner/driver/manager. |
| `order:leave`               | `{ orderId }`                        | Unsubscribe.                                                     |
| `restaurant:register`       | `{ restaurantId }`                   | Restaurant owner / manager listening for new orders.            |
| `delivery:location:update`  | `{ lat, lng, orderId? }`             | **Delivery agent only.** Pushes own GPS. Throttled 1/3s.         |

### 11.3 Server → client events

| Event                    | Payload                                                    | Sent to                |
|--------------------------|------------------------------------------------------------|------------------------|
| `connected`              | `{ userId, role }`                                         | Handshake success      |
| `error`                  | `{ code, message }`                                        | On auth or auth fail   |
| `order:new`              | full order summary                                         | `restaurant:<rid>` room|
| `order:status:updated`   | `{ orderId, status, note? }`                               | `order:<oid>` room     |
| `order:delivery:assigned`| `{ orderId, agentId, agentName, agentPhone }`              | `order:<oid>` room     |
| `delivery:location`      | `{ agentId, lat, lng, timestamp, orderId }`                | `order:<oid>` room     |
| `chat:new`               | `{ id, orderId, senderId, senderRole, content, createdAt }`| `order:<oid>` room     |

The mobile customer subscribes to `delivery:location` to render the live driver pin (see [DeliveryTrackingScreen.tsx](../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx) and [useDeliveryTracking.ts](../mobile/modules/Order/tracking/useDeliveryTracking.ts)).

---

## 12. End-to-end happy path (customer)

```
1. App launch
   - Restore session (refresh token from SecureStore)
   - Open Socket.IO connection with the access token

2. Browse
   GET /api/restaurant
   GET /api/restaurant/:id

3. Cart
   POST /api/order/cart/items   (one per meal)

4. (Optional) Validate promo
   POST /api/order/promo/validate

5. Checkout
   POST /api/order/checkout
     headers: Idempotency-Key: <uuid>
     paymentMethod: online | cash_on_delivery | card

6. (Online only) Upload payment proof
   POST /api/order/orders/:id/payment-proof  (multipart)

7. Watch the order live
   socket.emit('order:join', { orderId })
   socket.on('order:status:updated', …)
   socket.on('delivery:location', …)     // once driver assigned + out_for_delivery
   socket.on('chat:new', …)

8. Receipt / proof anytime
   GET /api/order/orders/:id/receipt
   GET /api/order/orders/:id/payment-proof

9. After delivery
   POST /api/order/orders/:id/rate
```

---

## 13. Delivery-agent happy path

```
1. Login → /api/auth/delivery/login
2. Open Socket.IO with the delivery token
3. Periodically (every ~3s while on duty) emit:
   socket.emit('delivery:location:update', { lat, lng, orderId })
4. Receive new-order pings on the agent's user room
5. On status changes from dispatcher:
   PATCH /api/order/orders/:id/status   { status: "out_for_delivery" }
   PATCH /api/order/orders/:id/status   { status: "delivered" }
6. The customer's app sees both the status transitions AND the live pin updates.
```

---

## 14. Error handling — recommended client logic

| HTTP   | Action                                                                                       |
|--------|----------------------------------------------------------------------------------------------|
| `400`  | Show the server's `message` (Arabic) — these are validation errors with user-friendly text. |
| `401`  | Trigger silent refresh; on second 401, force logout.                                         |
| `403`  | Show "غير مصرح" and navigate back. Could mean the user's role can't access this resource.    |
| `404`  | Item/order not found — refresh the list.                                                     |
| `409`  | Conflict (idempotency / busy table). Surface the server's `message` verbatim.                |
| `5xx`  | Show "حدث خطأ، يرجى المحاولة مرة أخرى" and offer retry.                                       |

Network errors (no response) should retry once with exponential back-off, then surface a "no connection" UI state.

---

## 15. Cheat sheet — full mobile endpoint table

| Verb     | Path                                              | Role             |
|----------|---------------------------------------------------|------------------|
| POST     | `/api/auth/customer/register`                     | public           |
| POST     | `/api/auth/customer/login`                        | public           |
| POST     | `/api/auth/customer/verify-login`                 | public           |
| POST     | `/api/auth/verify-otp`                            | public           |
| POST     | `/api/auth/resend-otp`                            | public           |
| POST     | `/api/auth/refresh`                               | public           |
| DELETE   | `/api/auth/logout`                                | any              |
| POST     | `/api/auth/change-password`                       | any              |
| GET      | `/api/auth/sessions`                              | any              |
| DELETE   | `/api/auth/sessions/:id`                          | any              |
| GET      | `/api/customer/profile`                           | customer         |
| POST     | `/api/customer/profile`                           | customer         |
| PATCH    | `/api/customer/profile`                           | customer         |
| GET      | `/api/customer/addresses`                         | customer         |
| POST     | `/api/customer/addresses`                         | customer         |
| PATCH    | `/api/customer/addresses/:id`                     | customer         |
| PATCH    | `/api/customer/addresses/:id/default`             | customer         |
| DELETE   | `/api/customer/addresses/:id`                     | customer         |
| GET      | `/api/restaurant`                                 | any              |
| GET      | `/api/restaurant/:id`                             | any              |
| GET      | `/api/order/cart`                                 | customer         |
| POST     | `/api/order/cart/items`                           | customer         |
| PATCH    | `/api/order/cart/items/:mealId`                   | customer         |
| DELETE   | `/api/order/cart/items/:mealId`                   | customer         |
| DELETE   | `/api/order/cart`                                 | customer         |
| POST     | `/api/order/promo/validate`                       | customer         |
| POST     | `/api/order/checkout`                             | customer         |
| GET      | `/api/order/orders`                               | any              |
| GET      | `/api/order/orders/:id`                           | participant      |
| PATCH    | `/api/order/orders/:id/status`                    | owner/mgr/driver |
| POST     | `/api/order/orders/:id/rate`                      | customer         |
| GET      | `/api/order/orders/:id/receipt`                   | participant      |
| POST     | `/api/order/orders/:id/payment-proof`             | customer         |
| GET      | `/api/order/orders/:id/payment-proof`             | participant      |
| GET      | `/api/order/orders/:id/chat`                      | participant      |
| POST     | `/api/order/orders/:id/chat`                      | participant      |
| POST     | `/api/delivery/profile`                           | public (post-OTP)|
| GET      | `/api/delivery/profile`                           | delivery         |
| GET      | `/api/delivery/profile/questions`                 | delivery         |
| POST     | `/api/delivery/location`                          | delivery         |

---

## 16. Checklist before submitting to App Store / Play Store

- [ ] Tokens stored in `SecureStore` / Keychain / EncryptedSharedPreferences — never in plain SharedPrefs/AsyncStorage.
- [ ] Silent token refresh tested under network loss + concurrent 401s.
- [ ] `Idempotency-Key` sent on every `POST /checkout`.
- [ ] Socket reconnects re-join all order rooms (the mobile `socketService` already does this — verify before release).
- [ ] Background location for the delivery agent is properly disclosed in app-store privacy strings.
- [ ] Production base URLs configured via build flavour (no `localhost` / LAN IP in the release build).
- [ ] Arabic `Accept-Language: ar` header is set so all server messages come back in Arabic.

---

## 17. Source-of-truth file pointers

| Concern                 | File                                                                                                            |
|-------------------------|-----------------------------------------------------------------------------------------------------------------|
| Cart & checkout (server)| [order-service.controller.ts](apps/order-service/src/order-service.controller.ts) + [order.service.ts](apps/order-service/src/order/order.service.ts) |
| Promo code logic        | [promo.service.ts](apps/order-service/src/promo/promo.service.ts)                                               |
| Auth & sessions         | [auth.controller.ts](apps/auth-service/src/auth.controller.ts)                                                  |
| Customer addresses      | [address.service.ts](apps/customer-service/src/address.service.ts)                                              |
| Delivery agent          | [delivery-service.controller.ts](apps/delivery-service/src/delivery-service.controller.ts)                      |
| WebSocket gateway       | [socket.gateway.ts](apps/api-gateway/src/gateway/socket.gateway.ts)                                             |
| Mobile socket client    | [app/mobile/socket/socket.service.ts](../mobile/socket/socket.service.ts)                                       |
| Mobile tracking screen  | [app/mobile/modules/Order/screens/DeliveryTrackingScreen.tsx](../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx) |
