# Restaurant Service — Mobile API Documentation

Professional reference for mobile developers integrating with the **JAHAZ Restaurant Service**. Covers profile, payment info (bank/wallet), and all restaurant-related endpoints needed by both the **customer app** and the **restaurant-owner app**.

---

## 1. Service info

| Property        | Value                                          |
| --------------- | ---------------------------------------------- |
| Service         | `restaurant-service`                           |
| Port (dev)      | `3003`                                         |
| Global prefix   | `/api/restaurant`                              |
| Base URL (dev)  | `http://<host>:3003/api/restaurant`            |
| Auth            | Bearer JWT in `Authorization` header           |
| Content-Type    | `application/json` (or `multipart/form-data` for file uploads) |

> A separate `payment-service` exists on port **3008** but is currently a stub (only `GET /api/payment/` returning "hello"). All real payment-account data lives on the **restaurant entity** under `paymentInfo` and is served by this service.

---

## 2. Roles & auth model

The mobile app sends a JWT in `Authorization: Bearer <token>`. The role embedded in the token decides which endpoints are reachable:

| Role               | Mobile-app context                                   |
| ------------------ | ---------------------------------------------------- |
| `customer`         | Browses restaurants, places orders                   |
| `restaurant_owner` | Manages their own restaurant profile + payment info  |
| `manager`          | Admin app — approves applications                    |
| (none / public)    | Can hit the `mobile/*` and `:id` listing endpoints   |

JWTs come from the **auth-service** (`/api/auth/*`, port 3004). See [order-service/MOBILE_API.md §2](../order-service/MOBILE_API.md) for the login flow.

---

## 3. paymentInfo — the canonical shape

`paymentInfo` is a discriminated union on `type`. The same shape is used everywhere — request bodies, GET responses, settings updates.

### 3.1 Bank account

```json
{
  "type": "bank_account",
  "bankName": "Bank of Palestine",
  "accountNumber": "1234567890",
  "iban": "PS92PALS000000000400123456701",
  "bankPhone": "+970599000000",
  "qrImageUrl": "https://<s3-presigned-url>"
}
```

`bankName` enum:
- `Bank of Palestine`
- `Palestine Islamic Bank`
- `Arab Islamic Bank`

`bankPhone` and `qrImageUrl` are optional. On responses, `qrImageUrl` is a **presigned S3 URL** (short-lived). On submission you do **not** send `qrImageUrl` — see §6.5 for the upload flow.

### 3.2 Wallet

```json
{
  "type": "wallet",
  "walletType": "PalPay",
  "accountNumber": "9876543210",
  "phone": "+970599000000",
  "qrImageUrl": "https://<s3-presigned-url>"
}
```

`walletType` enum:
- `PalPay`
- `Jawwal Pay`

`phone` is **required** for wallet type. `qrImageUrl` is optional.

### 3.3 Validation rules (server-side, surfaced as 400 errors)

- `type` must be `"bank_account"` or `"wallet"`.
- Bank: `bankName`, `accountNumber`, `iban` required.
- Wallet: `walletType`, `accountNumber`, `phone` required.
- Invalid enum values reject the whole request with the list of allowed values in `message`.

---

## 4. Customer-side endpoints (public — no auth required)

These power the **customer mobile app** when browsing restaurants and choosing how to pay.

### 4.1 List restaurants (paginated, lightweight)

```http
GET /mobile/restaurants?page=1&limit=10&city=Riyadh&search=pizza&cuisineType=italian
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "مطعم النيل",
      "logoUrl": "https://…",
      "coverUrl": "https://…",
      "city": "الرياض",
      "cuisineType": "italian",
      "rating": 4.6,
      "totalRatings": 218,
      "minOrderAmount": 25.00,
      "isOpen": true
    }
  ],
  "meta": {
    "total": 47, "page": 1, "limit": 10, "totalPages": 5,
    "hasNextPage": true, "hasPrevPage": false
  },
  "message": "تم استرجاع المطاعم."
}
```

Sorted by `isOpen DESC`, then `rating DESC`. Use this for the home feed.

### 4.2 Get one restaurant (header only — no menus, no paymentInfo)

```http
GET /mobile/restaurants/:id
```

Returns restaurant header + operating `hours[]`. **Does not include `paymentInfo`** — use §4.4 if you need it.

```json
{
  "data": {
    "id": "uuid",
    "name": "مطعم النيل",
    "description": "...",
    "logoUrl": "https://…",
    "coverUrl": "https://…",
    "phone": "+970…",
    "cuisineType": "italian",
    "street": "شارع الجيش 12",
    "city": "الرياض",
    "lat": 30.04442,
    "lng": 31.23571,
    "minOrderAmount": 25.00,
    "rating": 4.6,
    "totalRatings": 218,
    "isOpen": true,
    "hours": [
      { "dayOfWeek": 0, "openTime": "09:00", "closeTime": "00:00" }
    ]
  },
  "message": "تم استرجاع المطعم."
}
```

`dayOfWeek`: `0 = Sunday` … `6 = Saturday`.

### 4.3 List menus / get menu (customer browsing)

```http
GET /mobile/restaurants/:id/menus              → menus[] (no items)
GET /mobile/menus/:menuId                       → menu + sections[] + meals[] + optionGroups[]
GET /mobile/restaurants/:id/reviews?page=1&limit=20
```

### 4.4 Full public detail — **INCLUDES paymentInfo** ⚠️

```http
GET /:id
```

Returns the entire restaurant entity with the full menu tree **and `paymentInfo`** (presigned QR URL is NOT generated here — `qrImageUrl` may be a raw S3 key). Use this when the customer reaches the payment-method screen and you need to show the restaurant's bank account / wallet details for a bank-transfer payment.

```json
{
  "data": {
    "id": "uuid",
    "name": "مطعم النيل",
    "logoUrl": "...",
    "paymentInfo": {
      "type": "bank_account",
      "bankName": "Bank of Palestine",
      "accountNumber": "1234567890",
      "iban": "PS92PALS000000000400123456701",
      "bankPhone": "+970599000000",
      "qrImageUrl": "payment-qr/abc123.png"
    },
    "menus": [ /* full tree */ ]
  },
  "message": "Restaurant retrieved"
}
```

> **Mobile UX note**: when `paymentInfo.qrImageUrl` is a raw key (no `http://`), prepend the S3 public base URL or call `GET /profile` instead (it returns a presigned URL). Treat raw keys as "QR not loadable" and fall back to showing the IBAN / phone number with a copy button.

---

## 5. Restaurant-owner profile endpoints

These are the endpoints a **restaurant-owner mobile app** (if you build one) uses to manage its own profile and payment account. All require `Authorization: Bearer <token>` with role = `restaurant_owner`.

### 5.1 First-time profile completion

```http
POST /profile
Content-Type: multipart/form-data
```

Multipart fields:

| Field                     | Type     | Required | Notes                                                     |
| ------------------------- | -------- | -------- | --------------------------------------------------------- |
| `password`                | text     | yes      | min 8 chars                                               |
| `restaurantName`          | text     | yes      |                                                           |
| `ownerName`               | text     | yes      |                                                           |
| `ownerNationalIdNumber`   | text     | yes      | National ID                                               |
| `commercialRegNumber`     | text     | yes      | Commercial registration number                            |
| `restaurantPhone`         | text     | yes      |                                                           |
| `street`                  | text     | yes      |                                                           |
| `city`                    | text     | yes      |                                                           |
| `cuisineType`             | text     | yes      | ≤ 100 chars                                               |
| `description`             | text     | no       |                                                           |
| `lat`, `lng`              | text     | no       | Decimal numbers as strings                                |
| `paymentInfo`             | **text** | **yes**  | **JSON-encoded string** of the §3 shape (server parses it)|
| `termsAccepted`           | text     | yes      | `"true"` (string, server coerces to bool)                 |
| `logo`                    | file     | optional | image                                                     |
| `ownerIdPicture`          | file     | optional | image                                                     |

Example for the `paymentInfo` field value (sent as a string):

```
'{"type":"bank_account","bankName":"Bank of Palestine","accountNumber":"1234567890","iban":"PS92PALS000000000400123456701","bankPhone":"+970599000000"}'
```

After success, the restaurant enters **SUSPENDED** status awaiting manager approval (§7).

### 5.2 Get own profile (full, includes presigned URLs)

```http
GET /profile
```

Returns the full restaurant entity for the calling owner, with:
- `logoUrl` → presigned S3 URL
- `coverUrl` → presigned S3 URL
- `paymentInfo.qrImageUrl` → presigned S3 URL (resolved by `resolvePaymentQr`)

This is the **canonical source** for the owner's own payment-account display — always prefer this over `GET /:id` because URLs are pre-signed.

### 5.3 Update profile basics

```http
PATCH /profile
Content-Type: application/json
```

Body: any updatable subset (name, description, address, phone, etc.).

### 5.4 Update settings (incl. `paymentInfo`)

```http
PATCH /settings
Content-Type: application/json
```

Body (all optional — `UpdateSettingsDto`):
```json
{
  "lat": 30.044,
  "lng": 31.235,
  "deliveryRadiusKm": 5,
  "minOrderAmount": 25,
  "avgDeliveryMinutes": 30,
  "paymentInfo": {
    "type": "wallet",
    "walletType": "PalPay",
    "accountNumber": "9876543210",
    "phone": "+970599000000"
  },
  "kitchenPrinterIp": "192.168.1.50",
  "kitchenPrinterPort": 9100,
  "cashierPrinterIp": "192.168.1.51",
  "cashierPrinterPort": 9100
}
```

> Sending `kitchenPrinterIp: ""` (empty string) **clears** the printer. Other empty strings are not valid IPs and will be rejected.

`paymentInfo` here is sent as a **JSON object** (not a string — different from §5.1's multipart). The server runs the same `validatePaymentInfo()` rules.

### 5.5 Operating hours

```http
GET  /hours                              → returns hours[] for caller's restaurant
POST /hours    Body: { hours: [...] }    → bulk-replace
```

`hours[]` items: `{ dayOfWeek: 0..6, openTime: "HH:MM", closeTime: "HH:MM" }`.

### 5.6 Toggle open/closed (pause orders)

```http
PATCH /toggle-open
```

Flips `isOpen`. Use this for "I'm out of stock, pause for 30 min" — much faster than editing hours.

---

## 6. Payment-QR upload — current gap

`uploadPaymentQr()` exists in [restaurant-service.service.ts:448](src/restaurant-service.service.ts#L448) but **is not exposed by any controller route at the moment**. If you need a "Replace QR" button in the restaurant-owner app:

- **Workaround today**: set `qrImageUrl` directly in `PATCH /settings` if the client already has an S3 URL from another upload flow (not recommended — the server expects S3 keys).
- **Proper fix**: add a `POST /profile/payment-qr` route bound to `service.uploadPaymentQr(userId, file)`. Tell the user if this is needed and I'll wire it up.

---

## 7. Manager endpoints (admin app)

All require role = `manager`.

```http
GET   /manager/applications                            → pending restaurant applications
PATCH /manager/applications/:id/approve                → flip to ACTIVE
PATCH /manager/applications/:id/reject  Body: { reason }
```

The mobile admin app uses these to vet new restaurants before they appear in the customer feed.

---

## 8. Restaurant lifecycle (status)

| Status        | What it means                                            | Visible publicly?    |
| ------------- | -------------------------------------------------------- | -------------------- |
| `SUSPENDED`   | Just registered, awaiting `POST /profile` or admin approval | No                |
| `ACTIVE`      | Approved and live                                        | Yes                  |
| `BLOCKED`     | Suspended by an admin                                    | No                   |

Only `ACTIVE` restaurants appear in `mobile/restaurants` and `mobile/restaurants/:id`.

---

## 9. Quick-reference endpoint matrix

| Method  | Path                                          | Auth                | Purpose                                  |
| ------- | --------------------------------------------- | ------------------- | ---------------------------------------- |
| GET     | `/`                                           | public              | Legacy list (use `/mobile/restaurants`)  |
| GET     | `/mobile/restaurants`                         | public              | Customer-app home feed                   |
| GET     | `/mobile/restaurants/:id`                     | public              | Restaurant header (no menus, no payment) |
| GET     | `/mobile/restaurants/:id/menus`               | public              | Menu list                                |
| GET     | `/mobile/menus/:menuId`                       | public              | Full menu with sections, meals, options  |
| GET     | `/mobile/restaurants/:id/reviews`             | public              | Reviews + summary                        |
| GET     | `/:id`                                        | public              | Full restaurant + menu **+ paymentInfo** |
| GET     | `/public/tables/by-qr/:token`                 | public              | Resolve QR-scan to restaurant + table    |
| POST    | `/profile`                                    | restaurant_owner    | First-time setup (multipart)             |
| GET     | `/profile`                                    | restaurant_owner    | Own profile (presigned URLs)             |
| PATCH   | `/profile`                                    | restaurant_owner    | Update basics                            |
| PATCH   | `/settings`                                   | restaurant_owner    | Update settings + paymentInfo            |
| PATCH   | `/toggle-open`                                | restaurant_owner    | Pause / resume orders                    |
| GET     | `/hours`                                      | restaurant_owner    | Read hours                               |
| POST    | `/hours`                                      | restaurant_owner    | Replace hours                            |
| GET     | `/manager/applications`                       | manager             | Pending applications                     |
| PATCH   | `/manager/applications/:id/approve`           | manager             | Approve                                  |
| PATCH   | `/manager/applications/:id/reject`            | manager             | Reject with reason                       |
| GET     | `/categories`                                 | public              | Cuisine/restaurant categories            |
| GET     | `/accounting/summary?period=…`                | restaurant_owner    | Revenue/expense/net-profit summary       |
| GET     | `/analytics/payments`                         | restaurant_owner    | Payment-method breakdown analytics       |

---

## 10. Common mobile flows

### 10.1 Customer pays by bank transfer

```
1. POST /api/auth/customer/verify-login → accessToken
2. GET  /api/restaurant/mobile/restaurants?city=…           (browse)
3. GET  /api/restaurant/mobile/restaurants/:id              (detail screen)
4. GET  /api/restaurant/mobile/menus/:menuId                (menu screen)
   → add items via order-service /cart/items
5. POST /api/order/checkout (paymentMethod="online" or "card")
   → server returns Order with id
6. (display payment screen)
   GET /api/restaurant/:id                                  ← fetch paymentInfo
   → render IBAN + bankName + QR (qrImageUrl)
7. Customer transfers, then uploads proof:
   POST /api/order/orders/:id/payment-proof (multipart, "file")
```

### 10.2 Restaurant owner edits payment account

```
1. POST  /api/auth/restaurant/login                         → accessToken
2. GET   /api/restaurant/profile                            → render existing paymentInfo
3. User changes bank account
4. PATCH /api/restaurant/settings
   Body: { "paymentInfo": { "type": "bank_account", ... } }
5. GET   /api/restaurant/profile (refetch) → confirm update
```

---

## 11. Error model

Same envelope as `order-service`:

```json
{ "statusCode": 400, "message": "بيانات الدفع غير صحيحة.", "error": "Bad Request" }
```

`paymentInfo`-specific errors are returned with the exact reason in the `message` field — surface them verbatim to the user. The validation messages are already in Arabic.

| HTTP | When                                                              |
| ---- | ----------------------------------------------------------------- |
| 400  | Invalid `type`/`bankName`/`walletType`, missing required field     |
| 401  | Missing or expired token                                          |
| 403  | Wrong role (e.g. customer hitting `/profile`)                     |
| 404  | Restaurant not found / not ACTIVE                                 |
| 422  | Business rule (e.g. trying to approve already-approved application) |

---

## 12. Source-of-truth files

| Concern                | File                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Routes                 | [restaurant-service.controller.ts](src/restaurant-service.controller.ts)                   |
| Profile + payment logic| [restaurant-service.service.ts](src/restaurant-service.service.ts)                         |
| Profile DTO (multipart)| [dto/complete-profile.dto.ts](src/dto/complete-profile.dto.ts)                             |
| Settings DTO           | [dto/update-settings.dto.ts](src/dto/update-settings.dto.ts)                               |
| paymentInfo types + validators | [common/payment-info.ts](src/common/payment-info.ts)                               |
| Restaurant entity      | [entities/restaurant.entity.ts](src/entities/restaurant.entity.ts)                         |
| Bootstrap (port/prefix)| [main.ts](src/main.ts)                                                                     |

Trust the controller and DTO files — if a field name in this document disagrees with the code, the code wins. Open an issue or ping the backend channel and the doc will be corrected.
