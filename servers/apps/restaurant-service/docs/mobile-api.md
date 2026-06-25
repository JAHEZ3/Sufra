# Restaurant Service — Mobile API

Public, lightweight endpoints designed for the customer mobile app. All payloads return only the fields the app needs, image fields are pre-resolved to absolute URLs (presigned where applicable), and lists are paginated.

**Base URL:** `/api/restaurant`

**Auth:** None — these endpoints are public.

**Response shape:** Every endpoint returns an object of the form

```json
{ "data": <payload>, "message": "<arabic status string>" }
```

List endpoints additionally include a `meta` block with pagination info.

---

## 1. List restaurants

```http
GET /api/restaurant/mobile/restaurants
```

Returns a paginated list of **active** restaurants. Sorted by `is_open DESC, rating DESC` so open, highly-rated restaurants appear first.

### Query parameters

| Name          | Type   | Default | Notes                                     |
|---------------|--------|---------|-------------------------------------------|
| `page`        | int    | `1`     | Min `1`                                   |
| `limit`       | int    | `10`    | Min `1`, max `50`                         |
| `city`        | string | —       | Case-insensitive substring match          |
| `search`      | string | —       | Case-insensitive substring match on name  |
| `cuisineType` | enum   | —       | One of `CuisineType` (e.g. `pizza`)       |

### Example

```http
GET /api/restaurant/mobile/restaurants?page=1&limit=10&city=Riyadh
```

```json
{
  "data": [
    {
      "id": "8f1e…",
      "name": "Burger House",
      "logoUrl": "https://…/logo.png",
      "coverUrl": "https://…/cover.jpg",
      "city": "Riyadh",
      "cuisineType": "fast_food",
      "rating": 4.7,
      "totalRatings": 213,
      "minOrderAmount": 25,
      "isOpen": true
    }
  ],
  "meta": {
    "total": 47,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "message": "تم استرجاع المطاعم."
}
```

---

## 2. Get a restaurant

```http
GET /api/restaurant/mobile/restaurants/:id
```

Restaurant header + operating hours. Does **not** load menus — call `/menus` separately so the app can lazy-load tabs.

### Response

```json
{
  "data": {
    "id": "8f1e…",
    "name": "Burger House",
    "description": "…",
    "logoUrl": "https://…",
    "coverUrl": "https://…",
    "phone": "+9665…",
    "cuisineType": "fast_food",
    "street": "King Fahd Rd",
    "city": "Riyadh",
    "lat": 24.7136,
    "lng": 46.6753,
    "minOrderAmount": 25,
    "rating": 4.7,
    "totalRatings": 213,
    "isOpen": true,
    "hours": [
      { "id": "…", "restaurantId": "…", "dayOfWeek": 0, "openTime": "10:00:00", "closeTime": "23:00:00" }
    ]
  },
  "message": "تم استرجاع المطعم."
}
```

`dayOfWeek`: `0` = Sunday … `6` = Saturday.

---

## 3. List a restaurant's menus

```http
GET /api/restaurant/mobile/restaurants/:id/menus
```

Returns the active menus only, ordered by `displayOrder`. Each entry includes counts so the app can render badges or skip empty menus.

### Response

```json
{
  "data": [
    {
      "id": "menu-1",
      "name": "Lunch",
      "displayOrder": 0,
      "sectionCount": 4,
      "mealCount": 27
    }
  ],
  "message": "تم استرجاع القوائم."
}
```

---

## 4. Get a single menu (sections + meals + options)

```http
GET /api/restaurant/mobile/menus/:menuId
```

Returns the menu tree. Only **available** meals and **available** options are included — the mobile app does not need to filter.

### Response

```json
{
  "data": {
    "id": "menu-1",
    "restaurantId": "8f1e…",
    "name": "Lunch",
    "isActive": true,
    "displayOrder": 0,
    "sections": [
      {
        "id": "sec-1",
        "menuId": "menu-1",
        "name": "Burgers",
        "displayOrder": 0,
        "meals": [
          {
            "id": "meal-1",
            "sectionId": "sec-1",
            "restaurantId": "8f1e…",
            "name": "Classic Burger",
            "description": "…",
            "imageUrl": "https://…",
            "basePrice": 25,
            "discountPrice": null,
            "calories": 540,
            "isAvailable": true,
            "isFeatured": false,
            "tags": ["beef"],
            "displayOrder": 0,
            "createdAt": "…",
            "optionGroups": [
              {
                "id": "grp-1",
                "mealId": "meal-1",
                "name": "Cheese",
                "selectionType": "single",
                "isRequired": true,
                "maxSelections": 1,
                "options": [
                  { "id": "opt-1", "groupId": "grp-1", "name": "Cheddar", "extraPrice": 3, "isAvailable": true }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "message": "تم استرجاع القائمة."
}
```

---

## Errors

| Status | Body                                                |
|--------|-----------------------------------------------------|
| `400`  | `{ "message": "…" }` — validation (page/limit/UUID) |
| `404`  | `{ "message": "المطعم غير موجود." }` etc.           |

A `404` is returned if a restaurant is not `ACTIVE`, or if a menu is inactive, or if its parent restaurant is not active.

---

## Notes for clients

- `page` / `limit` are coerced from query strings — pass them as plain numbers in the URL.
- `imageUrl`, `logoUrl`, `coverUrl` are absolute URLs ready to render. Presigned S3 URLs expire after 1 hour; refetch the parent endpoint to get a fresh URL if you cache locally.
- `rating` and `minOrderAmount` come back as numbers (already coerced from `numeric`).
- The list endpoint hides closed-but-active restaurants below open ones — it does **not** exclude them, so the app can still display them with a "closed" badge.
