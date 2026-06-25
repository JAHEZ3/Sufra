# Customer Order Checkout — Full Flow

End-to-end reference for the customer checkout journey, covering authentication, address management, cart, fulfilment-mode selection (delivery / pickup / scheduled), promo codes, checkout, online payment proof, and live order tracking. Every endpoint listed has been verified against the current source code.

> Sister docs:
> - [MOBILE_API.md](../MOBILE_API.md) — broad mobile reference across all services
> - [apps/order-service/MOBILE_API.md](../apps/order-service/MOBILE_API.md) — exhaustive cart/orders details

---

## 0. Flow at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. Login (OTP) → access + refresh tokens                            │
│  2. Complete profile (firstName/lastName/lat/lng + avatar)           │
│  3. Browse restaurants → add meals to cart                           │
│  4. CHECKOUT SCREEN                                                  │
│     ├─ Pick orderType: delivery | pickup | scheduled                 │
│     ├─ If delivery/scheduled: pick address (saved | map | GPS)       │
│     │   with street + building + floor + notes                       │
│     ├─ If scheduled: pick datetime (≥ now + 30 min)                  │
│     ├─ Apply promo code (optional)                                   │
│     ├─ Pick payment method: cash | card | online                     │
│     └─ POST /checkout (Idempotency-Key)                              │
│  5. If online: POST /orders/:id/payment-proof  (multipart image)     │
│  6. Restaurant accepts → status: confirmed → preparing               │
│  7. Driver assigned → out_for_delivery                               │
│  8. Customer watches map (Socket.IO: delivery:location)              │
│  9. Delivered → POST /orders/:id/rate                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites

### 1.1 Auth headers on every protected call

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
Accept-Language: ar
```

On `401` → call `POST /api/auth/refresh` once with the stored `refreshToken`, then retry. On a second `401`, force re-login.

### 1.2 Service base paths (mobile env vars)

| Var                              | Default              |
|----------------------------------|----------------------|
| `EXPO_PUBLIC_API_URL_AUTH`       | `http://<host>:3004` |
| `EXPO_PUBLIC_API_URL_CUSTOMER`   | `http://<host>:3005` |
| `EXPO_PUBLIC_API_URL_DELIVERY`   | `http://<host>:3002` |
| `EXPO_PUBLIC_WS_URL`             | `ws://<host>:3000`   |

The order-service runs on `:3001` and the restaurant-service on `:3003`. In production all paths are reverse-proxied behind one hostname.

---

## 2. Saved addresses (customer-service)

The mobile address picker pulls from this CRUD. Addresses now carry **building**, **floor**, and **notes** in addition to street/city/lat/lng.

### 2.1 List

```http
GET /api/customer/addresses
→ {
    "data": [
      {
        "id": "<uuid>",
        "label": "البيت",
        "street": "شارع الرشيد",
        "city": "غزة",
        "building": "برج النور",
        "floor": "الطابق 3",
        "notes": "اقرع الجرس مرتين",
        "lat": 31.5017,
        "lng": 34.4668,
        "isDefault": true,
        "createdAt": "..."
      },
      ...
    ]
  }
```

### 2.2 Create

```http
POST /api/customer/addresses
{
  "label":    "البيت",
  "street":   "شارع الرشيد",
  "city":     "غزة",
  "building": "برج النور",
  "floor":    "الطابق 3",
  "notes":    "اقرع الجرس مرتين",
  "lat":      31.5017,
  "lng":      34.4668,
  "isDefault": false
}
```

First address created becomes the default automatically. Deleting the default promotes the next-most-recent.

### 2.3 Other operations

```
PATCH  /api/customer/addresses/:id                 → partial update
PATCH  /api/customer/addresses/:id/default         → set as default
DELETE /api/customer/addresses/:id
```

Source: [address.service.ts](../apps/customer-service/src/address.service.ts).

---

## 3. Cart (order-service)

All cart endpoints are JWT-protected with `Roles('customer')`.

```
GET    /api/order/cart                                → current cart
POST   /api/order/cart/items   { mealId, quantity, options?, notes? }
PATCH  /api/order/cart/items/:mealId   { quantity?, notes? }
DELETE /api/order/cart/items/:mealId
DELETE /api/order/cart                                → empty cart
```

Cart lives in Redis per-customer. Adding items from a different restaurant replaces the cart.

---

## 4. Fulfilment mode (`orderType`)

The customer picks one of three modes on the checkout screen. Type:

```ts
type OrderType = 'delivery' | 'pickup' | 'scheduled';
```

Defined in [checkout.dto.ts](../apps/order-service/src/order/checkout.dto.ts) and mirrored in [mobile/.../Order/types/index.ts](../../mobile/modules/Order/types/index.ts).

| `orderType` | Behaviour                                                                                                                                |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `delivery`  | (Default) Driver brings the order to the customer. `addressId` + snapshot required. Standard delivery-fee flow.                          |
| `pickup`    | Customer collects from the restaurant. **`deliveryFee` is force-zeroed server-side.** Address still required for tax/billing receipts.   |
| `scheduled` | Same as `delivery`, but executes at `scheduledFor`. Mobile enforces a **30-minute lead time** so restaurants have a prep buffer.          |

The mobile UI component is [OrderTypeSelector.tsx](../../mobile/modules/Order/components/OrderTypeSelector.tsx) — three vertical cards, RTL-aware, with a conditional datetime picker for "scheduled".

---

## 5. Promo code (optional, before checkout)

```http
POST /api/order/promo/validate
{
  "code":         "FREESHIP",
  "orderAmount":  92.5,
  "restaurantId": "<uuid>"
}
→ {
  "data": {
    "promoCodeId": "...",
    "discountAmount": 12.5,
    "code": "FREESHIP"
  },
  "message": "الكوبون صالح"
}
```

Server validation includes: date range, total usage cap, per-user cap, minimum order amount, restaurant scoping. On failure the server returns a 400 with a localized message.

---

## 6. Checkout — `POST /api/order/checkout`

The heart of the flow. **All addressed below are required only when `orderType !== 'pickup'`**.

### 6.1 Request

```http
POST /api/order/checkout
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid v4>            ← strongly recommended

{
  "addressId":     "<customer_address_uuid>",
  "paymentMethod": "cash_on_delivery" | "card" | "online",
  "orderType":     "delivery" | "pickup" | "scheduled",
  "scheduledFor":  "2026-05-20T19:30:00.000Z",   // only when orderType === "scheduled"
  "addressSnapshot": {
    "street":   "شارع الرشيد",
    "city":     "غزة",
    "lat":      31.5017,
    "lng":      34.4668,
    "label":    "البيت",
    "building": "برج النور",
    "floor":    "الطابق 3",
    "notes":    "اقرع الجرس مرتين"
  },
  "customerNotes":  "بدون بصل",
  "promoCode":      "FREESHIP",
  "deliveryFee":    8,                  // optional override; server zeroes when pickup
  "customerName":   "...",
  "customerPhone":  "+970...",
  "restaurantName": "..."
}
```

### 6.2 Idempotency

Pass `Idempotency-Key: <uuid>`. If the same key + customer is submitted again (eg. network retry), the server returns the **same** order with `message: "تم إرجاع الطلب الموجود"` — no duplicate row, no double charge. Server-side dedup is a unique `(customer_id, idempotency_key)` index.

### 6.3 Response

```json
{
  "data": {
    "id":             "<order_uuid>",
    "orderNumber":    "ORD-10042",
    "status":         "pending",
    "orderType":      "delivery",
    "scheduledFor":   null,
    "paymentMethod":  "online",
    "paymentStatus":  "unpaid",
    "subtotal":       80,
    "deliveryFee":    8,
    "discountAmount": 12.5,
    "totalAmount":    75.5,
    "deliveryAddressSnapshot": {
      "street": "...", "city": "...", "lat": 31.50, "lng": 34.47,
      "building": "...", "floor": "...", "notes": "..."
    },
    "items": [...],
    "createdAt": "..."
  },
  "message": "تم إنشاء الطلب بنجاح"
}
```

### 6.4 Side effects on checkout success

1. Cart is cleared.
2. `online_orders` row created with `status='pending'`, `payment_status='unpaid'`, `order_type` set, `scheduled_for` set when applicable.
3. NATS event `order.created` fires → api-gateway caches `order_meta:<orderId>` in Redis (for socket-room auth) and pushes `order:new` to the restaurant's WebSocket room.
4. Restaurant dashboard receives the event in real time.

Source: [order.service.ts](../apps/order-service/src/order/order.service.ts), `checkout()` method.

---

## 7. Online payment — proof upload (only when `paymentMethod === 'online'`)

There is **no card-gateway integration**. The `online` method means the customer pays by bank transfer or wallet to a restaurant account and uploads a screenshot.

### 7.1 Upload

```http
POST /api/order/orders/:id/payment-proof
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <jpg|png, ≤ 5 MB>
```

Stored in S3 under `payment-proofs/<orderId>/...`. The key is persisted on `orders.payment_proof_key`.

### 7.2 Fetch (any order participant)

```http
GET /api/order/orders/:id/payment-proof
→ { "data": { "url": "<presigned_s3_url>" } | null, "message": ... }
```

Returns `data: null` until the customer uploads.

### 7.3 When does each side check it?

- **Customer** — uploads from the success screen after `POST /checkout`.
- **Restaurant owner / Manager** — opens the order details dialog, sees the proof URL inline, then transitions the order from `pending` → `confirmed` (i.e. _accepts_).
- **Delivery agent** — never sees the proof.

---

## 8. Order acceptance & status transitions

All transitions go through:

```http
PATCH /api/order/orders/:id/status
{ "status": "confirmed", "note": "..." }
```

with `Roles('restaurant_owner', 'manager', 'delivery')`. The server enforces the state machine.

### 8.1 State machine (`OrderStatus`)

```
pending  ──(restaurant accepts)──►  confirmed
       ──(restaurant rejects)──►  cancelled  (terminal)

confirmed ──►  preparing
preparing ──►  ready_for_pickup    (auto after 15 min, BullMQ)
ready_for_pickup ──►  out_for_delivery   (driver picks up)
out_for_delivery ──►  delivered          (driver confirms drop-off)
```

Each transition:
- Writes a row to `order_status_history`.
- Emits `order:status:updated` on the `order:<id>` WebSocket room.
- Updates `paid_at` etc. as appropriate when reaching `delivered`.

### 8.2 "Restaurant accepts" + "Delivery accepts" in plain terms

- **Restaurant accepts** = `PATCH /status` with `status: "confirmed"` (or directly `"preparing"`).
- **Restaurant rejects** = `PATCH /status` with `status: "cancelled"`.
- **Delivery accepts** is implicit — when a manager assigns an agent via `PATCH /orders/:id/delivery`, the agent gets the order in their queue. The agent then signals pickup by transitioning `status` to `out_for_delivery`.

---

## 9. Live order tracking (WebSocket)

The customer sees a map with three pins:
- **Restaurant** (blue) — fetched from `/api/restaurant/:id`
- **Drop-off** (green) — from the order's `deliveryAddressSnapshot`
- **Driver** (orange, **live**) — pushed by the gateway as the driver mobile app emits its GPS

### 9.1 Connect

```ts
const socket = io(process.env.EXPO_PUBLIC_WS_URL, {
  transports: ['websocket'],
  auth: { token: `Bearer ${accessToken}` },
  reconnection: true,
});
```

JWT is verified once at handshake.

### 9.2 Subscribe to one order

```ts
socket.emit('order:join', { orderId });
```

Authorization: caller must be the customer, restaurant owner, assigned driver, or a manager. The gateway resolves identity from Redis (`order_meta:<id>`).

### 9.3 Events you'll receive

| Event                     | Payload                                                                          |
|---------------------------|----------------------------------------------------------------------------------|
| `order:status:updated`    | `{ orderId, status, note? }`                                                     |
| `order:delivery:assigned` | `{ orderId, agentId, agentName, agentPhone }`                                    |
| `delivery:location`       | `{ agentId, lat, lng, timestamp, orderId }`  (throttled to 1/3s per agent)       |
| `chat:new`                | `{ id, orderId, senderId, senderRole, content, createdAt }`                      |

### 9.4 Mobile customer code references

- [DeliveryTrackingScreen.tsx](../../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx) — the screen
- [useDeliveryTracking.ts](../../mobile/modules/Order/tracking/useDeliveryTracking.ts) — subscribes to `delivery:location`, computes bearing, exposes `{ coords, isLive, isStale }`
- [socket.service.ts](../../mobile/socket/socket.service.ts) — reconnect-safe singleton

### 9.5 Customer-friendly status mapping

These are the badges the customer sees on the tracking screen:

| Server `status`        | Customer label             |
|------------------------|----------------------------|
| `pending`              | بانتظار التأكيد            |
| `confirmed`            | تم تأكيد الطلب             |
| `preparing`            | يتم تحضير طلبك              |
| `ready_for_pickup`     | جاهز للاستلام من المطعم    |
| `out_for_delivery`     | السائق في الطريق إليك      |
| `delivered`            | تم التوصيل                  |
| `cancelled`            | تم إلغاء الطلب              |

---

## 10. Order history & detail

```
GET /api/order/orders               → paginated list (own orders for customer)
GET /api/order/orders/:id           → full detail (items, payment, delivery, status history)
GET /api/order/orders/:id/receipt   → presigned URL to the HTML invoice
```

Mobile screens: [OrdersScreen.tsx](../../mobile/modules/Order/screens/OrdersScreen.tsx) and [OrderDetailsScreen.tsx](../../mobile/modules/Order/screens/OrderDetailsScreen.tsx).

---

## 11. Error handling — recommended client logic

| HTTP   | Action                                                                                                    |
|--------|-----------------------------------------------------------------------------------------------------------|
| `400`  | Show the server's `message` (Arabic). Validation errors arrive as user-friendly strings.                  |
| `401`  | Silent refresh; on second `401`, force logout.                                                            |
| `403`  | Likely role mismatch — show "غير مصرح" and navigate back.                                                  |
| `404`  | Item / order not found — refresh the list.                                                                |
| `409`  | Conflict — busy table, duplicate idempotency, etc. Surface the server's `message` verbatim.               |
| `5xx`  | Show "حدث خطأ، يرجى المحاولة مرة أخرى" and offer retry.                                                    |

The mobile codebase already centralizes this in [`useCheckout.ts`](../../mobile/modules/Order/hooks/useCheckout.ts) — see `isCheckoutConflict`, `isCheckoutUnauthorized`, `isCheckoutBusinessError`, `isNetworkError`.

---

## 12. End-to-end happy path — curl

```sh
# 1. OTP login
USER_ID=$(curl -s -X POST http://localhost:3004/api/auth/customer/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+970599000000"}' | jq -r .data.userId)

TOKENS=$(curl -s -X POST http://localhost:3004/api/auth/customer/verify-login \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+970599000000\",\"code\":\"123456\"}")
ACCESS=$(echo "$TOKENS" | jq -r .data.accessToken)

# 2. Create / fetch a saved address
ADDR=$(curl -s -X POST http://localhost:3005/api/customer/addresses \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{
    "label":"البيت","street":"شارع الرشيد","city":"غزة",
    "building":"برج النور","floor":"الطابق 3","notes":"اقرع الجرس مرتين",
    "lat":31.5017,"lng":34.4668
  }')
ADDR_ID=$(echo "$ADDR" | jq -r .data.id)

# 3. Add a meal to the cart
curl -s -X POST http://localhost:3001/api/order/cart/items \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"mealId":"<MEAL_UUID>","quantity":2}'

# 4. Checkout (scheduled, online payment)
ORDER=$(curl -s -X POST http://localhost:3001/api/order/checkout \
  -H "Authorization: Bearer $ACCESS" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H 'Content-Type: application/json' \
  -d "{
    \"addressId\": \"$ADDR_ID\",
    \"paymentMethod\": \"online\",
    \"orderType\": \"scheduled\",
    \"scheduledFor\": \"2026-05-21T18:30:00.000Z\",
    \"addressSnapshot\": {
      \"street\":\"شارع الرشيد\",\"city\":\"غزة\",\"lat\":31.5017,\"lng\":34.4668,
      \"building\":\"برج النور\",\"floor\":\"3\",\"notes\":\"اقرع الجرس مرتين\"
    },
    \"customerNotes\":\"بدون بصل\"
  }")
ORDER_ID=$(echo "$ORDER" | jq -r .data.id)

# 5. Upload payment proof
curl -s -X POST http://localhost:3001/api/order/orders/$ORDER_ID/payment-proof \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@./bank-receipt.jpg"

# 6. Read back the order
curl -s http://localhost:3001/api/order/orders/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS" | jq .
```

---

## 13. Mobile screen ↔ endpoint map

| Screen                                                                                                | Talks to                                                                                                            |
|-------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| [CheckoutScreen.tsx](../../mobile/modules/Order/screens/CheckoutScreen.tsx)                           | `POST /checkout`, `POST /promo/validate`, `GET /addresses` (when picker added)                                      |
| [OrderSuccessScreen.tsx](../../mobile/modules/Order/screens/OrderSuccessScreen.tsx)                   | `GET /orders/:id`, `POST /orders/:id/payment-proof` (when wired)                                                    |
| [OrdersScreen.tsx](../../mobile/modules/Order/screens/OrdersScreen.tsx)                               | `GET /orders`                                                                                                       |
| [OrderDetailsScreen.tsx](../../mobile/modules/Order/screens/OrderDetailsScreen.tsx)                   | `GET /orders/:id`, `GET /receipt`, `GET /payment-proof`, `POST /rate`                                               |
| [DeliveryTrackingScreen.tsx](../../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx)           | `GET /orders/:id` + Socket.IO `order:join` / `delivery:location` / `order:status:updated`                           |
| [OrderChatScreen.tsx](../../mobile/modules/Order/screens/OrderChatScreen.tsx)                         | `GET /orders/:id/chat`, `POST /orders/:id/chat`, Socket.IO `chat:new` + `chat:typing`                               |

---

## 14. Field reference — quick lookup

### CheckoutDto (request)

| Field                | Type            | Required          | Notes                                                                                                |
|----------------------|-----------------|-------------------|------------------------------------------------------------------------------------------------------|
| `addressId`          | uuid            | yes               | FK to `customer_addresses.id`. Client may generate a v4 if no saved address is selected.             |
| `paymentMethod`      | enum            | yes               | `cash_on_delivery` \| `card` \| `online`                                                              |
| `orderType`          | enum            | no                | `delivery` (default) \| `pickup` \| `scheduled`                                                       |
| `scheduledFor`       | ISO datetime    | when scheduled    | Must be ≥ now + 30 min (enforced client-side; server takes any future ISO datetime).                  |
| `addressSnapshot`    | object          | yes (non-pickup)  | See below.                                                                                            |
| `promoCode`          | string          | no                | If invalid the **checkout fails** — validate first via `/promo/validate`.                             |
| `deliveryFee`        | number          | no                | Optional override. Server **forces 0** when `orderType === 'pickup'`.                                 |
| `customerNotes`      | string          | no                | Free text for the restaurant (e.g. "no onions").                                                      |
| `customerName`       | string          | no                | Snapshot for the receipt.                                                                             |
| `customerPhone`      | string          | no                | Snapshot for the receipt.                                                                             |
| `restaurantName`     | string          | no                | Snapshot for the receipt.                                                                             |
| `ownerUserId`        | uuid            | no                | Used for WS room targeting; server resolves it from `restaurants.owner_user_id` if omitted.           |
| `idempotencyKey`     | uuid (header)   | recommended       | Sent as `Idempotency-Key` HTTP header.                                                                |

### AddressSnapshot

| Field      | Type   | Notes                                                                              |
|------------|--------|------------------------------------------------------------------------------------|
| `street`   | string | Required.                                                                          |
| `city`     | string | Required.                                                                          |
| `lat`      | number | Required.                                                                          |
| `lng`      | number | Required.                                                                          |
| `label`    | string | Optional ("home", "office").                                                       |
| `building` | string | **New.** Building name or number.                                                  |
| `floor`    | string | **New.** Free string ("3", "ground", "B2").                                        |
| `notes`    | string | **New.** Driver-facing instructions (door code, landmark…).                        |

---

## 15. What's still TODO (per session backlog)

1. **Saved-address picker sheet** in [CheckoutScreen](../../mobile/modules/Order/screens/CheckoutScreen.tsx) — bottom sheet with chips for "Use current GPS" + "Pick on map" + the user's saved addresses.
2. **Payment-proof upload** UI on [OrderSuccessScreen](../../mobile/modules/Order/screens/OrderSuccessScreen.tsx) — multipart `POST /orders/:id/payment-proof`.
3. **Restaurant "Accept/Reject" buttons** wired in the dashboard for `pending` orders.
4. **Status-timeline overlay** on [DeliveryTrackingScreen](../../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx) — Preparing / On the way / Arrived / Delivered with timestamps.
5. **Polish "My Orders"** — empty state, error UI, deep-link into tracking screen.
