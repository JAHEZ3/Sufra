# Order Service — Mobile API Documentation

Professional reference for mobile developers (iOS / Android / Flutter / React Native) integrating with the **JAHAZ Order Service**.

> All endpoints below are HTTP/JSON unless marked as WebSocket. Examples use `curl`; the JSON bodies and headers apply identically to any HTTP client (Dio, Retrofit, URLSession, axios, etc.).

---

## 1. Service topology

| Service          | Base URL (dev)                          | Purpose                                       |
| ---------------- | --------------------------------------- | --------------------------------------------- |
| Auth Service     | `http://<host>:3004/api/auth`           | Register, login, OTP, refresh, sessions       |
| **Order Service**| `http://<host>:3001/api/order`          | Cart, checkout, orders, chat, promo           |
| API Gateway (WS) | `ws://<host>:<gateway-port>` (Socket.IO)| Real-time order/chat/delivery events          |

In production the mobile app talks to a single public hostname; the reverse proxy routes `/api/order/*` to port 3001 and `/api/auth/*` to port 3004. Confirm the production base URL with DevOps before release.

---

## 2. Authentication

Every protected endpoint requires a Bearer JWT.

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
Accept-Language: ar
```

### 2.1 Customer registration + OTP flow

```
1. POST /api/auth/customer/register   → returns userId, sends OTP via SMS
2. POST /api/auth/verify-otp          → returns accessToken, refreshToken
3. (later)  POST /api/auth/refresh    → rotates accessToken
4. (logout) DELETE /api/auth/logout   → invalidates current refreshToken
```

### 2.2 Customer login (OTP-based)

```
1. POST /api/auth/customer/login        body: { phone }
2. POST /api/auth/customer/verify-login body: { phone, code }   → { accessToken, refreshToken, user }
```

Store both tokens in the device secure storage (Keychain / EncryptedSharedPreferences). On `401`, call `/api/auth/refresh` once and retry the request; if refresh fails, force re-login.

---

## 3. Response envelope

Every order-service endpoint returns:

```json
{
  "data": <payload-or-null>,
  "message": "<Arabic user-facing message or null>"
}
```

Errors return HTTP 4xx/5xx with:

```json
{
  "statusCode": 400,
  "message": "رسالة عربية للمستخدم",
  "error": "Bad Request"
}
```

Always surface `message` directly to the user — the backend already provides Arabic copy.

---

## 4. Cart endpoints (customer only)

Base: `/api/order`

### 4.1 Get current cart

```
GET /cart
```

Response:
```json
{
  "data": {
    "items": [
      {
        "mealId": "uuid",
        "mealName": "بيتزا مارجريتا",
        "mealImage": "https://…",
        "restaurantId": "uuid",
        "restaurantName": "مطعم النيل",
        "basePrice": 45.00,
        "quantity": 2,
        "specialInstructions": "بدون بصل",
        "options": [
          { "optionId": "uuid", "optionName": "كبير", "extraPrice": 10 }
        ],
        "lineTotal": 110.00
      }
    ],
    "subtotal": 110.00
  },
  "message": null
}
```

### 4.2 Add item

```
POST /cart/items
```

Body (validated by `AddToCartDto`):
```json
{
  "restaurantId": "uuid",
  "restaurantName": "مطعم النيل",
  "mealId": "uuid",
  "mealName": "بيتزا مارجريتا",
  "mealImage": "https://…",
  "basePrice": 45.00,
  "quantity": 2,
  "specialInstructions": "بدون بصل",
  "options": [
    { "optionId": "uuid", "optionName": "كبير", "extraPrice": 10 }
  ]
}
```

Behavior: cart is **scoped to a single restaurant** — adding from a different restaurant clears the previous cart server-side.

### 4.3 Update quantity / notes

```
PATCH /cart/items/:mealId
```

Body:
```json
{ "quantity": 3, "specialInstructions": "إضافي جبنة" }
```

Setting `quantity: 0` is equivalent to deleting the line.

### 4.4 Remove single item

```
DELETE /cart/items/:mealId
```

### 4.5 Clear cart

```
DELETE /cart
```

---

## 5. Checkout

### 5.1 Place an order

```
POST /checkout
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: <client-generated UUID v4>      ← REQUIRED in production
```

Body (`CheckoutDto`):
```json
{
  "addressId": "uuid",
  "paymentMethod": "cash_on_delivery",   // or "card", "online"
  "promoCode": "SUMMER25",
  "customerNotes": "اتصل قبل الوصول",
  "deliveryFee": 15.00,
  "addressSnapshot": {
    "street": "شارع الجيش 12",
    "city": "القاهرة",
    "lat": 30.04442,
    "lng": 31.23571,
    "label": "البيت"
  },
  "customerName": "أحمد سالم",
  "customerPhone": "+201234567890",
  "ownerUserId": "uuid",
  "restaurantName": "مطعم النيل"
}
```

> **Idempotency-Key is critical on mobile.** Network retries on flaky connections must reuse the same UUID — the server returns the previously-created order instead of double-charging. Generate one UUID per checkout attempt; persist it locally until you get a 2xx.

Response: full `Order` object with `id`, `orderNumber`, `status="pending"`, items, totals. If the request was a duplicate, `message` is `"تم إرجاع الطلب الموجود"`.

---

## 6. Order endpoints

### 6.1 List orders (paginated)

```
GET /orders?kind=online&status=pending&page=1&limit=20&search=…
```

Query params (`OrderFilterDto`):
- `kind` — `online` (delivery) or `local` (POS). Default `online`.
- `status` — see enum below.
- `restaurantId` — uuid (manager/owner only).
- `search` — order number or customer name.
- `page`, `limit` — pagination.

Response:
```json
{
  "data": {
    "items": [ { ...Order } ],
    "total": 47,
    "page": 1,
    "limit": 20
  },
  "message": null
}
```

### 6.2 Get one order

```
GET /orders/:id
```

Returns full order with `items[]`, `statusHistory[]`, delivery snapshot, totals.

### 6.3 Update status

```
PATCH /orders/:id/status
```

Body:
```json
{ "status": "cancelled", "note": "اعتذار من العميل" }
```

Customer can cancel only while status is `pending`. Manager/restaurant can advance the lifecycle.

### 6.4 Assign delivery agent (manager / restaurant owner)

```
PATCH /orders/:id/delivery
Body: { "deliveryAgentId": "uuid" }
```

### 6.5 Rate an order (customer, after delivery)

```
POST /orders/:id/rate
Body:
{
  "foodRating": 5,
  "deliveryRating": 4,
  "comment": "اللحم كان رائعاً"
}
```

### 6.6 Get receipt (presigned URL)

```
GET /orders/:id/receipt
→ { "data": { "url": "https://s3…?sig=…" }, "message": null }
```

Open the URL in the device PDF viewer. The signed URL is short-lived (typically 15 min) — refetch when needed.

### 6.7 Payment proof (bank-transfer flow)

Upload (multipart):
```
POST /orders/:id/payment-proof
Content-Type: multipart/form-data
field name: "file"     (max 5 MB, jpg/png/pdf)
```

Retrieve:
```
GET /orders/:id/payment-proof → { data: { url }, … }
```

---

## 7. Order chat (customer ↔ restaurant ↔ delivery agent)

Hybrid: send/list via HTTP, receive in real-time via WebSocket.

### 7.1 List messages

```
GET /orders/:id/chat
```

Returns `ChatMessage[]` ordered ascending. Apply pagination on the client if needed (small chats expected).

### 7.2 Send a message

```
POST /orders/:id/chat
Body: { "content": "وين الطلب؟" }      // ≤ 2000 chars
```

The server broadcasts the message to all participants of the order via the WebSocket event `chat:new`.

---

## 8. Promo codes (customer)

### 8.1 Validate before checkout

```
POST /promo/validate
Body:
{
  "code": "SUMMER25",
  "orderAmount": 120.00,
  "restaurantId": "uuid"
}
```

Response:
```json
{
  "data": {
    "valid": true,
    "discountType": "percentage",   // or "fixed"
    "discountValue": 25,
    "discountAmount": 30.00,
    "finalAmount": 90.00
  },
  "message": "الكوبون صالح"
}
```

Show the discounted total on the checkout screen, then pass the same `code` in the `promoCode` field of the checkout body.

---

## 9. WebSocket — real-time events

The app should hold one Socket.IO connection while the user is logged in (customer app) or active (delivery app).

### 9.1 Connect

```js
const socket = io('https://<gateway-host>', {
  transports: ['websocket'],
  auth: { token: accessToken },          // sent during handshake
});
```

Server emits `connected` on success or `error` + disconnect on auth failure.

### 9.2 Join an order room (required to receive updates)

```js
socket.emit('order:join', { orderId }, (ack) => {
  // ack === { event: 'order:joined', data: { orderId } }
});
```

Call `order:join` after opening the order details screen; call `order:leave` on screen dispose.

### 9.3 Events received

| Event                  | Payload                                                                 | When                                            |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `order:created`        | `{ order }`                                                             | A new order matching your scope was placed.     |
| `order:status:updated` | `{ orderId, status, note }`                                             | Status moved (e.g., `confirmed → preparing`).   |
| `order:delivery:assigned` | `{ orderId, deliveryAgent }`                                         | Manager attached a delivery agent.              |
| `delivery:location`    | `{ orderId, agentId, lat, lng, updatedAt }`                             | Live driver location — throttled to ~1 / 3 sec. |
| `chat:new`             | `{ orderId, message }`                                                  | New chat message.                               |
| `chat:typing`          | `{ orderId, userId, role }`                                             | Other participant is typing.                    |

### 9.4 Events to emit

| Event                       | Payload                            | Notes                                  |
| --------------------------- | ---------------------------------- | -------------------------------------- |
| `order:join`                | `{ orderId }`                      | Subscribe to that order's room.        |
| `order:leave`               | `{ orderId }`                      | Unsubscribe.                           |
| `chat:typing`               | `{ orderId }`                      | Throttle to 1 emit / 2 sec on client.  |
| `delivery:location:update`  | `{ lat, lng, accuracy?, orderId? }`| Delivery app only. Server throttles to 1 update / 3 sec per agent. |

Reconnect with exponential backoff (Socket.IO does this by default). After every reconnect, re-emit `order:join` for any orders currently open on screen.

---

## 10. Order lifecycle reference

### 10.1 `status` (online order — `OrderStatus`)

```
pending → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered
                                                                    ↘ cancelled
                                                                    ↘ refunded
```

Suggested mobile copy:

| Status              | Customer UI label              |
| ------------------- | ------------------------------ |
| `pending`           | في انتظار التأكيد              |
| `confirmed`         | تم التأكيد                     |
| `preparing`         | يتم التحضير الآن               |
| `ready_for_pickup`  | جاهز للاستلام                  |
| `out_for_delivery`  | في الطريق إليك                 |
| `delivered`         | تم التوصيل                     |
| `cancelled`         | ملغي                           |
| `refunded`          | مسترجع                         |

### 10.2 `paymentMethod` (`PaymentMethod`)

`cash_on_delivery` · `card` · `online`

### 10.3 `paymentStatus` (`PaymentStatus`)

`unpaid` · `paid` · `refunded`

---

## 11. Error handling — recommended client logic

| HTTP | Meaning                          | Mobile action                                                                 |
| ---- | -------------------------------- | ----------------------------------------------------------------------------- |
| 400  | Validation failed                | Show `message` as inline form error.                                          |
| 401  | Token expired / invalid          | Call `/api/auth/refresh` once → retry. If it fails, route to login.           |
| 403  | Forbidden (role mismatch)        | Show generic "غير مصرح" and log out role-tampered state.                      |
| 404  | Order/cart/item not found        | Pop the screen and refresh the previous list.                                 |
| 409  | Conflict (e.g., idempotency)     | Trust the returned order — it's the canonical one.                            |
| 422  | Business rule blocked            | Show `message`. (e.g., promo expired, cart empty)                             |
| 5xx  | Server error                     | Snackbar + retry button. Do not silent-retry POSTs without an idempotency key.|

---

## 12. End-to-end happy path (customer ordering)

```
1.  POST /api/auth/customer/login            → OTP sent
2.  POST /api/auth/customer/verify-login     → accessToken
3.  (Browse restaurants/meals — restaurant-service, not covered here)
4.  POST /api/order/cart/items               × N
5.  GET  /api/order/cart                     (review)
6.  POST /api/order/promo/validate           (optional)
7.  POST /api/order/checkout                 + Idempotency-Key header
        → returns Order with id, orderNumber
8.  WS  socket.emit('order:join', { orderId })
9.  WS  listen 'order:status:updated' for live progress
10. WS  listen 'delivery:location' for map updates (once out_for_delivery)
11. GET /api/order/orders/:id/receipt        (after delivered)
12. POST /api/order/orders/:id/rate
```

---

## 13. Quick smoke-test (curl)

```bash
# 1. Get a token (replace phone/code with real values from your test SMS)
TOKEN=$(curl -s -X POST http://localhost:3004/api/auth/customer/verify-login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+201111111111","code":"123456"}' | jq -r .data.accessToken)

# 2. Add to cart
curl -X POST http://localhost:3001/api/order/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "restaurantId":"…","restaurantName":"…","mealId":"…","mealName":"…","basePrice":45,"quantity":2 }'

# 3. Checkout
curl -X POST http://localhost:3001/api/order/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H 'Content-Type: application/json' \
  -d '{ "addressId":"…","paymentMethod":"cash_on_delivery" }'
```

---

## 14. Checklist before submitting to App Store / Play Store

- [ ] Production base URL configured via build flavor (no localhost in release).
- [ ] Access token stored in secure storage; never in `SharedPreferences`/`UserDefaults` plain.
- [ ] All POST `/checkout` calls send a fresh `Idempotency-Key`.
- [ ] Network retries are idempotent (GET, PATCH-with-key) — never blind-retry POST `/checkout` without the same key.
- [ ] WebSocket reconnects re-emit `order:join` for orders on screen.
- [ ] Errors render `message` field (Arabic) directly.
- [ ] Receipt PDF opened via system viewer, not embedded WebView (signed URL safety).
- [ ] Payment-proof uploads compressed client-side to stay under 5 MB.

---

## 15. Source-of-truth file pointers

| Concern               | File                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| All endpoints         | [order-service.controller.ts](src/order-service.controller.ts)                                                 |
| Cart DTOs             | [cart/cart.dto.ts](src/cart/cart.dto.ts)                                                                       |
| Checkout DTO          | [order/checkout.dto.ts](src/order/checkout.dto.ts)                                                             |
| Chat DTO              | [chat/chat.dto.ts](src/chat/chat.dto.ts)                                                                       |
| Promo DTOs            | [promo/promo.dto.ts](src/promo/promo.dto.ts)                                                                   |
| Status / enums        | [entities/order-enums.ts](src/entities/order-enums.ts)                                                         |
| WebSocket gateway     | [../api-gateway/src/gateway/socket.gateway.ts](../api-gateway/src/gateway/socket.gateway.ts)                   |
| Service bootstrap     | [main.ts](src/main.ts)                                                                                         |

When in doubt, **the controller and DTO files are authoritative** — this document follows them, not the other way around. If a field name disagrees, trust the code.
