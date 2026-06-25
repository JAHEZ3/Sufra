# "My Orders" — Customer API

Reference for mobile developers integrating the customer-facing order history and detail screens. Every endpoint is JWT-protected and auto-scoped server-side, so the client never has to send a `customerId` filter.

> All paths below sit under the **order-service** (port 3001 in dev). The mobile env var is `EXPO_PUBLIC_API_URL_ORDER` (or the proxy alias the app already uses).

---

## 1. List my orders

```
GET /api/order/orders
```

### Headers
```http
Authorization: Bearer <accessToken>
Accept-Language: ar
```

### Query params (all optional)

| Name           | Type             | Default      | Notes                                                                                          |
|----------------|------------------|--------------|------------------------------------------------------------------------------------------------|
| `page`         | number           | `1`          | 1-based page index.                                                                            |
| `limit`        | number           | `20`         | Page size. Server caps it at `50`.                                                              |
| `kind`         | `online`/`local` | `online`     | Customers only ever see `online`. Passing `local` returns an empty list (POS bills aren't theirs). |
| `status`       | string           | _(any)_      | Filter by `OrderStatus`: `pending`, `confirmed`, `preparing`, `ready_for_pickup`, `out_for_delivery`, `delivered`, `cancelled`. |
| `search`       | string           | _(any)_      | Case-insensitive match on `orderNumber` or `customerNameSnapshot`.                              |

### Response

```jsonc
{
  "data": {
    "data": [
      {
        "id":            "<order_uuid>",
        "orderNumber":   "ORD-10042",
        "status":        "out_for_delivery",
        "orderType":     "delivery",          // delivery | pickup | scheduled
        "scheduledFor":  null,
        "totalAmount":   92.5,
        "deliveryFee":   8,
        "discountAmount":0,
        "paymentMethod": "online",
        "paymentStatus": "unpaid",
        "restaurantId":  "<uuid>",
        "restaurantNameSnapshot": "...",
        "deliveryAddressSnapshot": {
          "street":"...","city":"...","lat":31.50,"lng":34.47,
          "label":"...","building":"...","floor":"...","notes":"..."
        },
        "items": [
          {
            "id": "...",
            "mealNameSnapshot": "...",
            "quantity": 2,
            "unitPriceSnapshot": 40,
            "totalPrice": 80,
            "specialInstructions": null
          }
        ],
        "createdAt": "2026-05-21T12:00:00.000Z"
      }
      /* ...up to `limit` rows... */
    ],
    "total":  124,
    "page":   1,
    "limit":  20,
    "pages":  7
  },
  "message": null
}
```

### Server-side scoping (why no `customerId` param is needed)

[order.service.ts:338](../apps/order-service/src/order/order.service.ts#L338) — when `req.user.role === 'customer'` the query builder appends:

```ts
qb.andWhere('o.customerId = :userId', { userId });
```

A customer can never see another customer's orders via this endpoint, even with crafted query params. Server enforces it.

### Sort & pagination

- Orders are always returned `ORDER BY createdAt DESC` — most recent first.
- `data.data` is the page slice; `data.total` is the unfiltered total matching the filters.
- `data.pages = Math.ceil(total / limit)` — server pre-computes for the client.

### Empty result

For a brand-new customer:

```json
{ "data": { "data": [], "total": 0, "page": 1, "limit": 20, "pages": 0 }, "message": null }
```

The mobile `OrdersScreen` should treat `total === 0` as the empty state, not as a network error.

### Errors

| Status | Cause                                              | Client action                           |
|--------|----------------------------------------------------|-----------------------------------------|
| `401`  | Missing / expired token                            | Silent refresh, then retry              |
| `400`  | Bad query (invalid `kind`, `status`, etc.)         | Show the server's `message` verbatim    |
| `5xx`  | Server / DB issue                                  | Retry once, then show offline UI        |

Network errors (`ECONNRESET`, timeout) should retry once with back-off, then show an "offline" UI state.

### Mobile snippet (TanStack Query)

```ts
// app/mobile/modules/Order/hooks/useMyOrders.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { orderRepository } from "../repository";

export const useMyOrders = (status?: string) =>
  useInfiniteQuery({
    queryKey: ["my-orders", status ?? "all"],
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) =>
      orderRepository.listMine({ page: pageParam, limit: 20, status }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
```

---

## 2. One order, full detail

```
GET /api/order/orders/:id
```

Same auth + scoping. Customers only see their own orders; a `403` or `404` is returned otherwise.

### Response

```jsonc
{
  "data": {
    "id":             "...",
    "orderNumber":    "ORD-10042",
    "status":         "out_for_delivery",
    "orderType":      "delivery",
    "scheduledFor":   null,
    "paymentMethod":  "online",
    "paymentStatus":  "unpaid",
    "subtotal":       80,
    "deliveryFee":    8,
    "discountAmount": 0,
    "totalAmount":    88,

    "customerNotes":  "بدون بصل",
    "preparingStartedAt": "2026-05-21T12:10:00.000Z",
    "estimatedDeliveryAt": "2026-05-21T12:45:00.000Z",
    "deliveredAt":    null,

    "restaurantId":              "...",
    "restaurantNameSnapshot":    "...",
    "deliveryAddressSnapshot":   { /* same shape as in list */ },
    "deliveryAgentId":           "<uuid|null>",

    "items": [
      { "id": "...", "mealNameSnapshot": "...", "quantity": 2,
        "unitPriceSnapshot": 40, "totalPrice": 80,
        "options": [...], "specialInstructions": null }
    ],

    "statusHistory": [
      { "status": "pending",    "changedAt": "...", "note": null,  "actor": "system" },
      { "status": "confirmed",  "changedAt": "...", "note": null,  "actor": "restaurant" },
      { "status": "preparing",  "changedAt": "...", "note": null,  "actor": "restaurant" },
      { "status": "out_for_delivery", "changedAt": "...", "note": null, "actor": "delivery" }
    ],

    "receiptKey":      "...",          // truthy → receipt is ready
    "paymentProofKey": null,           // truthy → proof uploaded
    "rating":          null,
    "createdAt":       "..."
  },
  "message": null
}
```

### Status timeline mapping (for mobile UI)

```
pending             → بانتظار التأكيد
confirmed           → تم تأكيد الطلب
preparing           → يتم تحضير طلبك
ready_for_pickup    → جاهز للاستلام من المطعم
out_for_delivery    → السائق في الطريق إليك
delivered           → تم التوصيل
cancelled           → تم إلغاء الطلب
```

---

## 3. Companion endpoints (also customer-callable)

These are referenced from the order-detail screen and the tracking screen.

| Verb   | Path                                            | Purpose                                                                        |
|--------|-------------------------------------------------|--------------------------------------------------------------------------------|
| GET    | `/api/order/orders/:id/receipt`                 | Presigned URL to the HTML receipt. `data: null` until the receipt is generated. |
| POST   | `/api/order/orders/:id/payment-proof`           | Multipart upload of a bank-transfer screenshot (online payments).               |
| GET    | `/api/order/orders/:id/payment-proof`           | Presigned URL to the customer's uploaded proof. `data: null` until uploaded.   |
| POST   | `/api/order/orders/:id/rate`                    | `{ foodRating, deliveryRating, comment? }` — once, after `delivered`.          |
| GET    | `/api/order/orders/:id/chat`                    | Chat history for this order.                                                    |
| POST   | `/api/order/orders/:id/chat`                    | `{ content }` — sends a chat message in the order room.                         |
| PATCH  | `/api/order/orders/:id/delivery`                | `{ deliveryAgentId }` — customer self-pick (before any driver is assigned).    |
| GET    | `/api/delivery/open?lat=…&lng=…&city=…`         | Online drivers near the customer (for the self-pick flow).                      |

---

## 4. Real-time updates (WebSocket)

Whenever any of these happen, the server emits events to the order room (`order:<id>`):

| Event                     | Trigger                                             |
|---------------------------|-----------------------------------------------------|
| `order:status:updated`    | Restaurant / driver / system transitions the order. |
| `order:delivery:assigned` | A driver gets attached to the order.                |
| `delivery:location`       | Driver pushes a GPS update (throttled to 1/3s).     |
| `chat:new`                | A new chat message is sent.                         |

Mobile customers subscribe by emitting:

```ts
socket.emit('order:join', { orderId });
// later, when leaving the screen:
socket.emit('order:leave', { orderId });
```

[useDeliveryTracking.ts](../../mobile/modules/Order/tracking/useDeliveryTracking.ts) already wraps this pattern with reconnect-safe behaviour.

---

## 5. Mobile screen → endpoint cheat-sheet

| Mobile screen                                                                                   | Calls                                                                                         |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| [OrdersScreen.tsx](../../mobile/modules/Order/screens/OrdersScreen.tsx) (My Orders)             | `GET /api/order/orders?page=N&limit=20[&status=...]`                                          |
| [OrderDetailsScreen.tsx](../../mobile/modules/Order/screens/OrderDetailsScreen.tsx)             | `GET /api/order/orders/:id`, `GET /receipt`, `GET /payment-proof`, `POST /rate`               |
| [DeliveryTrackingScreen.tsx](../../mobile/modules/Order/screens/DeliveryTrackingScreen.tsx)     | `GET /api/order/orders/:id` + Socket.IO `order:join` / `order:status:updated` / `delivery:location` |
| [OrderChatScreen.tsx](../../mobile/modules/Order/screens/OrderChatScreen.tsx)                   | `GET /chat`, `POST /chat`, Socket.IO `chat:new`                                               |
| [OrderSuccessScreen.tsx](../../mobile/modules/Order/screens/OrderSuccessScreen.tsx)             | `GET /api/order/orders/:id`, **(planned)** `POST /payment-proof`                              |

---

## 6. Recommended client behaviour

- **Polling vs sockets** — for an order in any non-terminal status (`!= delivered && != cancelled`), open the WebSocket subscription instead of polling `/orders/:id`. For terminal statuses, no live updates are needed.
- **Cache invalidation** — when `order:status:updated` arrives, invalidate the `["my-orders", ...]` query so the list reflects the new status.
- **Empty state** — distinguish "no orders yet" (`total === 0`) from "request failed" (axios threw). The mobile `OrdersScreen` should not show "نقّ لإعادة المحاولة" for an empty list.
- **Pull-to-refresh** — re-fetch the **first page** only, then call `refetch` on TanStack's infinite query to invalidate subsequent pages.
- **Pagination loader** — show a thin spinner under the last row while `isFetchingNextPage`; never block the existing rows with a full-screen loader.

---

## 7. Quick smoke test (curl)

```sh
ACCESS=...  # from /api/auth/customer/verify-login

# List first page
curl -s "http://localhost:3001/api/order/orders?page=1&limit=20" \
  -H "Authorization: Bearer $ACCESS" | jq

# Filter by status
curl -s "http://localhost:3001/api/order/orders?status=out_for_delivery" \
  -H "Authorization: Bearer $ACCESS" | jq

# One order
curl -s "http://localhost:3001/api/order/orders/$ORDER_ID" \
  -H "Authorization: Bearer $ACCESS" | jq
```

---

## 8. Source-of-truth file pointers

| Concern                  | File                                                                            |
|--------------------------|---------------------------------------------------------------------------------|
| List endpoint            | [order-service.controller.ts:150](../apps/order-service/src/order-service.controller.ts#L150) |
| Detail endpoint          | [order-service.controller.ts:157](../apps/order-service/src/order-service.controller.ts#L157) |
| Server scoping (customer)| [order.service.ts:344](../apps/order-service/src/order/order.service.ts#L344)   |
| Filter DTO               | [checkout.dto.ts `OrderFilterDto`](../apps/order-service/src/order/checkout.dto.ts) |
| Mobile list screen       | [OrdersScreen.tsx](../../mobile/modules/Order/screens/OrdersScreen.tsx)         |
| Mobile detail screen     | [OrderDetailsScreen.tsx](../../mobile/modules/Order/screens/OrderDetailsScreen.tsx) |
