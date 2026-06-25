import axios, { AxiosError, AxiosResponse } from "axios";
import Cookies from "js-cookie";
import type { ApiError, ApiResponse, Paginated } from "@/types/common.types";
import type { AuthTokens, LoginCredentials } from "@/types/auth.types";
import type {
  ChangeUserStatusPayload,
  ChangeUserStatusResponse,
  ListUsersParams,
  UpdateUserPayload,
  User,
} from "@/types/user.types";
import type {
  ChangeRestaurantStatusPayload,
  ChangeRestaurantStatusResponse,
  ListRestaurantsParams,
  RejectApplicationPayload,
  Restaurant,
  RestaurantApplication,
  UpdateRestaurantPayload,
} from "@/types/restaurant.types";
import type {
  ChangeAgentStatusPayload,
  ChangeAgentStatusResponse,
  DeliveryAgent,
  DeliveryApplication,
  ListAgentsParams,
  RejectAgentApplicationPayload,
  UpdateAgentPayload,
} from "@/types/delivery.types";
import type {
  CreateCategoryPayload,
  RestaurantCategory,
  UpdateCategoryPayload,
} from "@/types/category.types";
import type {
  CustomersAnalytics,
  DeliveryAnalytics,
  OrdersAnalytics,
  OverviewAnalytics,
  PaymentsAnalytics,
  PublicStats,
  RestaurantsAnalytics,
  RevenueAnalytics,
} from "@/types/analytics.types";
import type {
  BroadcastNotificationPayload,
  BroadcastResult,
  NotificationListResponse,
  SendToPhonePayload,
} from "@/types/notification.types";
import type {
  CreateSupportTicketPayload,
  ListSupportTicketsParams,
  SupportTicket,
  UpdateSupportTicketStatusPayload,
} from "@/types/support.types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const ACCESS_TOKEN_COOKIE = "panel_access_token";
export const REFRESH_TOKEN_COOKIE = "panel_refresh_token";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get(ACCESS_TOKEN_COOKIE);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove(ACCESS_TOKEN_COOKIE);
      Cookies.remove(REFRESH_TOKEN_COOKIE);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Extracts the backend Arabic message from an axios error, falling back gracefully. */
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiError>(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
  }
  return fallback;
}

/** Unwraps the backend envelope `{ data, message }` into the typed payload. */
export function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  return res.data.data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  loginManager: (credentials: LoginCredentials) =>
    api.post<ApiResponse<AuthTokens>>("/auth/manager/login", credentials),
  logout: (refreshToken: string) =>
    api.delete<ApiResponse<null>>("/auth/logout", { data: { refreshToken } }),
};

// ─── Users (auth-service) ────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: ListUsersParams) =>
    api.get<ApiResponse<Paginated<User>>>("/auth/manager/users", { params }),
  getOne: (id: string) =>
    api.get<ApiResponse<User>>(`/auth/manager/users/${id}`),
  update: (id: string, payload: UpdateUserPayload) =>
    api.patch<ApiResponse<User>>(`/auth/manager/users/${id}`, payload),
  changeStatus: (id: string, payload: ChangeUserStatusPayload) =>
    api.patch<ApiResponse<ChangeUserStatusResponse>>(
      `/auth/manager/users/${id}/status`,
      payload,
    ),
  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/auth/manager/users/${id}`),

  /** @deprecated prototype shim — use `list` with typed params */
  getAll: (params?: object) => api.get("/auth/manager/users", { params }),
  /** @deprecated prototype shim — backend has no `isActive` flag; use `changeStatus` */
  toggleStatus: (_id: string, _isActive: boolean) =>
    Promise.reject(
      new Error("toggleStatus is unsupported — call changeStatus({ status })"),
    ),
};

// ─── Restaurants (restaurant-service) ────────────────────────────────────────
export const restaurantsApi = {
  // Applications
  listApplications: () =>
    api.get<ApiResponse<RestaurantApplication[]>>(
      "/restaurant/manager/applications",
    ),
  approveApplication: (id: string) =>
    api.patch<ApiResponse<null>>(
      `/restaurant/manager/applications/${id}/approve`,
    ),
  rejectApplication: (id: string, payload: RejectApplicationPayload) =>
    api.patch<ApiResponse<null>>(
      `/restaurant/manager/applications/${id}/reject`,
      payload,
    ),

  // Restaurants
  list: (params?: ListRestaurantsParams) =>
    api.get<ApiResponse<Paginated<Restaurant>>>(
      "/restaurant/manager/restaurants",
      { params },
    ),
  getOne: (id: string) =>
    api.get<ApiResponse<Restaurant>>(`/restaurant/manager/restaurants/${id}`),
  /** Full restaurant view: profile + hours + menus → sections → meals → option groups → options. */
  getFull: (id: string) =>
    api.get<ApiResponse<unknown>>(`/restaurant/manager/restaurants/${id}/full`),
  update: (id: string, payload: UpdateRestaurantPayload) =>
    api.patch<ApiResponse<Restaurant>>(
      `/restaurant/manager/restaurants/${id}`,
      payload,
    ),
  changeStatus: (id: string, payload: ChangeRestaurantStatusPayload) =>
    api.patch<ApiResponse<ChangeRestaurantStatusResponse>>(
      `/restaurant/manager/restaurants/${id}/status`,
      payload,
    ),
  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/restaurant/manager/restaurants/${id}`),
  /** AI-generate a branded cover image. Optional accentColor overrides the logo-sampled color. */
  generateCover: (id: string, payload?: { accentColor?: string }) =>
    api.post<
      ApiResponse<{ coverUrl: string; coverKey: string; accentColor: string }>
    >(`/restaurant/manager/restaurants/${id}/cover/ai`, payload ?? {}),

  /** Paginated reviews for a restaurant + summary totals. */
  listReviews: (id: string, page = 1, limit = 20) =>
    api.get<ApiResponse<RestaurantReviewsList>>(
      `/restaurant/manager/restaurants/${id}/reviews`,
      { params: { page, limit } },
    ),
};

export interface RestaurantReview {
  id: string;
  orderId: string;
  customerId: string;
  foodRating: number;
  deliveryRating: number;
  comment: string | null;
  createdAt: string;
}

export interface RestaurantReviewsList {
  items: RestaurantReview[];
  total: number;
  page: number;
  limit: number;
  summary: {
    avgFoodRating: number;
    avgDeliveryRating: number;
    totalRatings: number;
    distribution: { stars: number; count: number }[];
  };
}

// ─── Delivery agents (delivery-service) ──────────────────────────────────────
export const deliveryApi = {
  // Applications
  listApplications: () =>
    api.get<ApiResponse<DeliveryApplication[]>>(
      "/delivery/manager/applications",
    ),
  approveApplication: (id: string) =>
    api.patch<ApiResponse<null>>(
      `/delivery/manager/applications/${id}/approve`,
    ),
  rejectApplication: (id: string, payload: RejectAgentApplicationPayload) =>
    api.patch<ApiResponse<null>>(
      `/delivery/manager/applications/${id}/reject`,
      payload,
    ),

  // Agents
  list: (params?: ListAgentsParams) =>
    api.get<ApiResponse<Paginated<DeliveryAgent>>>(
      "/delivery/manager/agents",
      { params },
    ),
  getOne: (id: string) =>
    api.get<ApiResponse<DeliveryAgent>>(`/delivery/manager/agents/${id}`),
  update: (id: string, payload: UpdateAgentPayload) =>
    api.patch<ApiResponse<DeliveryAgent>>(
      `/delivery/manager/agents/${id}`,
      payload,
    ),
  changeStatus: (id: string, payload: ChangeAgentStatusPayload) =>
    api.patch<ApiResponse<ChangeAgentStatusResponse>>(
      `/delivery/manager/agents/${id}/status`,
      payload,
    ),
  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/delivery/manager/agents/${id}`),
};

// ─── Restaurant categories (restaurant-service) ──────────────────────────────
export const categoriesApi = {
  list: () =>
    api.get<ApiResponse<RestaurantCategory[]>>("/restaurant/categories"),
  create: (payload: CreateCategoryPayload) =>
    api.post<ApiResponse<RestaurantCategory>>(
      "/restaurant/manager/categories",
      payload,
    ),
  update: (id: string, payload: UpdateCategoryPayload) =>
    api.patch<ApiResponse<RestaurantCategory>>(
      `/restaurant/manager/categories/${id}`,
      payload,
    ),
  delete: (id: string) =>
    api.delete<ApiResponse<{ id: string }>>(
      `/restaurant/manager/categories/${id}`,
    ),
};

// ─── Legacy aliases kept for existing pages ──────────────────────────────────
/** @deprecated prototype shim — use `restaurantsApi` instead */
export const adminRestaurantsApi = {
  ...restaurantsApi,
  getAll: (params?: object) => api.get("/restaurant/manager/restaurants", { params }),
  approve: (id: string) =>
    api.patch(`/restaurant/manager/applications/${id}/approve`),
  suspend: (id: string, reason?: string) =>
    api.patch(`/restaurant/manager/applications/${id}/reject`, { reason }),
};

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  restaurantName: string;
  driverName: string | null;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready_for_pickup"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "refunded";
  totalAmount: number;
  itemsCount: number;
  city: string;
  createdAt: string;
}

export interface AdminOrdersList {
  items: AdminOrderRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAdminOrdersParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminOrderDeliveryAddress {
  street?: string;
  city?: string;
  lat?: number;
  lng?: number;
  label?: string;
}

export interface AdminOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions: string | null;
}

export interface AdminOrderDetails {
  order: {
    id: string;
    orderNumber: string;
    status: AdminOrderRow["status"];
    createdAt: string;
    deliveredAt: string | null;
    estimatedDeliveryAt: string | null;
    customerNotes: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    address: AdminOrderDeliveryAddress | null;
  };
  restaurant: {
    id: string;
    name: string;
    city: string | null;
  };
  delivery: {
    status: string;
    distanceKm: number | null;
    agentEarnings: number | null;
    deliveredAt: string | null;
    agent: { id: string; name: string; city: string | null } | null;
  } | null;
  payment: {
    method: "cash_on_delivery" | "card" | "online";
    status: "unpaid" | "paid" | "refunded";
    subtotal: number;
    deliveryFee: number;
    discountAmount: number;
    totalAmount: number;
  };
  items: AdminOrderItem[];
}

export const adminOrdersApi = {
  list: (params?: ListAdminOrdersParams) =>
    api.get<ApiResponse<AdminOrdersList>>("/manager/orders", { params }),
  /** @deprecated prototype shim — use `list` and read `data.items` */
  getAll: (params?: ListAdminOrdersParams) =>
    api.get<ApiResponse<AdminOrdersList>>("/manager/orders", { params }),
  getOne: (id: string) =>
    api.get<ApiResponse<AdminOrderDetails>>(`/manager/orders/${id}`),
  /** Flip an online order's paymentStatus after reviewing the proof. Hits
   *  the order-service directly (not manager-service) — the order-service
   *  endpoint accepts the `manager` role. */
  updatePaymentStatus: (
    id: string,
    data: { paymentStatus: "paid" | "unpaid"; note?: string },
  ) =>
    api.patch<ApiResponse<{ id: string; paymentStatus: string }>>(
      `/order/orders/${id}/payment-status`,
      data,
    ),
};

export interface UserMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
export interface RestaurantMapPoint extends UserMapPoint {
  city: string | null;
  status: string;
}
export interface DriverMapPoint extends UserMapPoint {
  recordedAt: string;
}
export interface UserMapResponse {
  restaurants: RestaurantMapPoint[];
  customers: UserMapPoint[];
  drivers: DriverMapPoint[];
}

export const mapApi = {
  users: () => api.get<ApiResponse<UserMapResponse>>("/manager/map/users"),
};

// ─── Promo codes / coupons ────────────────────────────────────────────────────

export type PromoDiscountType = "percentage" | "fixed_amount";

export interface PromoCode {
  id: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountCap: number | null;
  minOrderAmount: number;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  restaurantId: string | null;
  validFrom: string | null;
  validUntil: string | null;
}

export interface CreatePromoPayload {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscountCap?: number;
  minOrderAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  restaurantId?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface UpdatePromoPayload {
  usageLimit?: number;
  maxDiscountCap?: number;
  validUntil?: string;
}

export const promoCodesApi = {
  list: (restaurantId?: string) =>
    api.get<ApiResponse<PromoCode[]>>("/order/manager/promo-codes", {
      params: restaurantId ? { restaurantId } : undefined,
    }),
  create: (payload: CreatePromoPayload) =>
    api.post<ApiResponse<PromoCode>>("/order/manager/promo-codes", payload),
  update: (id: string, payload: UpdatePromoPayload) =>
    api.patch<ApiResponse<PromoCode>>(`/order/manager/promo-codes/${id}`, payload),
  remove: (id: string) =>
    api.delete<ApiResponse<null>>(`/order/manager/promo-codes/${id}`),
};
export const settingsApi = {
  get: () => api.get("/manager/admin/settings"),
  /** Replace any sections provided in `data` (full overwrite per section). */
  replace: (data: object) => api.post("/manager/admin/settings", data),
  /** Shallow-merge any sections provided in `data`. */
  update: (data: object) => api.patch("/manager/admin/settings", data),
  /** Upload a new platform logo. Returns the resolved (presigned) URL. */
  uploadLogo: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return api.patch<ApiResponse<{ logoUrl: string | null }>>(
      "/manager/admin/settings/logo",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  },
};

// ─── Analytics (manager-service) ─────────────────────────────────────────────
export const analyticsApi = {
  /** Public landing-page stats — no auth required. */
  publicStats: () =>
    api.get<ApiResponse<PublicStats>>("/manager/public/stats"),
  overview: () =>
    api.get<ApiResponse<OverviewAnalytics>>("/manager/analytics"),
  orders: () =>
    api.get<ApiResponse<OrdersAnalytics>>("/manager/analytics/orders"),
  revenue: () =>
    api.get<ApiResponse<RevenueAnalytics>>("/manager/analytics/revenue"),
  restaurants: () =>
    api.get<ApiResponse<RestaurantsAnalytics>>("/manager/analytics/restaurants"),
  customers: () =>
    api.get<ApiResponse<CustomersAnalytics>>("/manager/analytics/customers"),
  delivery: () =>
    api.get<ApiResponse<DeliveryAnalytics>>("/manager/analytics/delivery"),
  payments: () =>
    api.get<ApiResponse<PaymentsAnalytics>>("/manager/analytics/payments"),
};

/** @deprecated use `analyticsApi.overview` */
export const statsApi = {
  overview: () => analyticsApi.overview(),
};

// ─── Support tickets (manager-service) ───────────────────────────────────────
export const supportApi = {
  create: (payload: CreateSupportTicketPayload) =>
    api.post<ApiResponse<SupportTicket> | SupportTicket>(
      "/manager/admin/support/tickets",
      payload,
    ),
  list: (params?: ListSupportTicketsParams) =>
    api.get<ApiResponse<Paginated<SupportTicket>> | Paginated<SupportTicket>>(
      "/manager/admin/support/tickets",
      { params },
    ),
  getOne: (id: string) =>
    api.get<ApiResponse<SupportTicket> | SupportTicket>(
      `/manager/admin/support/tickets/${id}`,
    ),
  updateStatus: (id: string, payload: UpdateSupportTicketStatusPayload) =>
    api.patch<ApiResponse<SupportTicket> | SupportTicket>(
      `/manager/admin/support/tickets/${id}/status`,
      payload,
    ),
};

/** Unwraps a manager-service response that may be either `{data, message}` or raw. */
export function unwrapManager<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in (body as object)) {
    const root = body as { data: T };
    return root.data;
  }
  return body as T;
}

// ─── Notifications (notification-service) ────────────────────────────────────
export const notificationApi = {
  list: (page = 1, limit = 20) =>
    api.get<ApiResponse<NotificationListResponse>>(
      "/notification/notifications",
      { params: { page, limit } },
    ),
  markRead: (id: string) =>
    api.patch<ApiResponse<null>>(`/notification/notifications/${id}/read`),
  markAllRead: () =>
    api.patch<ApiResponse<null>>("/notification/notifications/read-all"),

  // Manager-only
  broadcast: (payload: BroadcastNotificationPayload) =>
    api.post<ApiResponse<BroadcastResult>>(
      "/notification/notifications/broadcast",
      payload,
    ),
  sendToPhone: (payload: SendToPhonePayload) =>
    api.post<ApiResponse<null>>(
      "/notification/notifications/send-to-phone",
      payload,
    ),
};
