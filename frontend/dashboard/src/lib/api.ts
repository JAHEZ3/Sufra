import axios from "axios";
import Cookies from "js-cookie";
import { useAuthStore } from "@/store/authStore";
import { navigateTo } from "@/lib/navigation";

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data?.message === "string") return data.message;
    if (Array.isArray(data?.message)) return data.message[0];
    if (typeof data?.error === "string") return data.error;
  }
  if (err instanceof Error) return err.message;
  return "حدث خطأ، يرجى المحاولة مرة أخرى";
}

export function normalizeTokens(
  payload: unknown
): { accessToken: string; refreshToken: string } | null {
  const root = payload as Record<string, unknown> | null | undefined;
  // Unwrap { success, data: {...} } envelope if present
  const d = (root?.data ?? root) as Record<string, unknown> | null | undefined;
  const accessToken  = (d?.accessToken  ?? d?.access_token)  as string | undefined;
  const refreshToken = (d?.refreshToken ?? d?.refresh_token) as string | undefined;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004";
const RESTAURANT_URL = process.env.NEXT_PUBLIC_RESTAURANT_URL || "http://localhost:3003";
const NOTIFICATION_URL = process.env.NEXT_PUBLIC_NOTIFICATION_URL || "http://localhost:3007";
const MANAGER_URL = process.env.NEXT_PUBLIC_MANAGER_URL || "http://localhost:3006";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const restaurantInstance = axios.create({
  baseURL: RESTAURANT_URL,
  headers: { "Content-Type": "application/json" },
});

export const notificationInstance = axios.create({
  baseURL: NOTIFICATION_URL,
  headers: { "Content-Type": "application/json" },
});

export const managerInstance = axios.create({
  baseURL: MANAGER_URL,
  headers: { "Content-Type": "application/json" },
});

// Shared request interceptor: attach accessToken from Zustand + strip Content-Type for FormData
function attachToken(config: import("axios").InternalAxiosRequestConfig) {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers["Content-Type"];
  return config;
}

api.interceptors.request.use(attachToken);
restaurantInstance.interceptors.request.use(attachToken);
notificationInstance.interceptors.request.use(attachToken);
managerInstance.interceptors.request.use(attachToken);

// Token refresh state
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (t: string) => void;
  reject: (e: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  pendingQueue = [];
}

function redirectToLogin() {
  navigateTo("/login");
}

// Shared 401 refresh handler used by both axios instances
async function handle401(
  error: import("axios").AxiosError,
  retryInstance: typeof api
) {
  const original = error.config!;
  if (error.response?.status !== 401 || (original as unknown as Record<string, unknown>)._retry) {
    return Promise.reject(error);
  }

  const refreshToken = Cookies.get("refresh_token");
  if (!refreshToken) {
    redirectToLogin();
    return Promise.reject(error);
  }

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingQueue.push({
        resolve: (token) => {
          original.headers!.Authorization = `Bearer ${token}`;
          resolve(retryInstance(original));
        },
        reject,
      });
    });
  }

  (original as unknown as Record<string, unknown>)._retry = true;
  isRefreshing = true;

  try {
    const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
    const tokens = normalizeTokens(data);
    if (!tokens) throw new Error("No tokens in refresh response");
    useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
    flushQueue(null, tokens.accessToken);
    original.headers!.Authorization = `Bearer ${tokens.accessToken}`;
    return retryInstance(original);
  } catch (refreshError) {
    flushQueue(refreshError, null);
    useAuthStore.getState().logout();
    redirectToLogin();
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use((res) => res, (err) => handle401(err, api));
restaurantInstance.interceptors.response.use((res) => res, (err) => handle401(err, restaurantInstance));
notificationInstance.interceptors.response.use((res) => res, (err) => handle401(err, notificationInstance));
managerInstance.interceptors.response.use((res) => res, (err) => handle401(err, managerInstance));

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  registerRestaurant: (data: { phone: string; password: string; restaurantName: string }) =>
    api.post("/api/auth/restaurant/register", data),

  verifyOtp: (phone: string, otp: string) =>
    api.post("/api/auth/verify-otp", { phone, otp }),

  resendOtp: (phone: string) => api.post("/api/auth/resend-otp", { phone }),

  loginRestaurant: (phone: string, password: string) =>
    api.post("/api/auth/restaurant/login", { phone, password }),

  forgotPassword: (phone: string) =>
    api.post("/api/auth/forgot-password", { phone }),

  resetPassword: (phone: string, otp: string, newPassword: string) =>
    api.post("/api/auth/reset-password", { phone, otp, newPassword }),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.post("/api/auth/change-password", { oldPassword, newPassword }),

  refresh: (refreshToken: string) =>
    api.post("/api/auth/refresh", { refreshToken }),

  logout: (refreshToken: string) =>
    api.delete("/api/auth/logout", { data: { refreshToken } }),

  listSessions: (refreshToken?: string) =>
    api.get("/api/auth/sessions", {
      params: refreshToken ? { refreshToken } : undefined,
    }),

  revokeSession: (id: string) => api.delete(`/api/auth/sessions/${id}`),

  revokeOtherSessions: (refreshToken: string) =>
    api.delete("/api/auth/sessions", { data: { refreshToken } }),
};

// ── Restaurant (port 3003) ────────────────────────────────────────────────────
export const restaurantApi = {
  completeProfile: (data: FormData) =>
    restaurantInstance.post("/api/restaurant/profile", data),

  getProfile: () => restaurantInstance.get("/api/restaurant/profile"),

  updateProfile: (data: object) =>
    restaurantInstance.patch("/api/restaurant/profile", data),

  updateSettings: (data: object) =>
    restaurantInstance.patch("/api/restaurant/settings", data),

  // Branding: logo + cover image (multipart) + brandColor. Send a FormData.
  updateBranding: (data: FormData) =>
    restaurantInstance.patch("/api/restaurant/branding", data),

  toggleOpen: () => restaurantInstance.patch("/api/restaurant/toggle-open"),

  getHours: () => restaurantInstance.get("/api/restaurant/hours"),

  setHours: (
    hours: { dayOfWeek: number; openTime: string; closeTime: string }[],
  ) => restaurantInstance.post("/api/restaurant/hours", { hours }),

  getPublicList: (city?: string) =>
    restaurantInstance.get("/api/restaurant", { params: city ? { city } : undefined }),

  getPublicById: (id: string) => restaurantInstance.get(`/api/restaurant/${id}`),

  getDashboardStats: () => restaurantInstance.get("/api/restaurant/me/stats"),

  getSalesData: (period: "daily" | "weekly" | "monthly") =>
    restaurantInstance.get(`/api/restaurant/me/sales?period=${period}`),

  getTopMeals: () => restaurantInstance.get("/api/restaurant/me/top-meals"),
};

// ── Analytics (restaurant-service, owner-scoped) ─────────────────────────────
export const analyticsApi = {
  overview: () => restaurantInstance.get("/api/restaurant/analytics"),
  orders: () => restaurantInstance.get("/api/restaurant/analytics/orders"),
  revenue: () => restaurantInstance.get("/api/restaurant/analytics/revenue"),
  topMeals: () => restaurantInstance.get("/api/restaurant/analytics/top-meals"),
  customers: () => restaurantInstance.get("/api/restaurant/analytics/customers"),
  ratings: () => restaurantInstance.get("/api/restaurant/analytics/ratings"),
  reviews: (page = 1, limit = 20) =>
    restaurantInstance.get("/api/restaurant/analytics/reviews", {
      params: { page, limit },
    }),
  restaurantReviews: (
    page = 1,
    limit = 20,
    sort: "latest" | "highest" | "lowest" = "latest",
  ) =>
    restaurantInstance.get("/api/restaurant/analytics/restaurant-reviews", {
      params: { page, limit, sort },
    }),
  restaurantRatingsSummary: () =>
    restaurantInstance.get(
      "/api/restaurant/analytics/restaurant-ratings/summary",
    ),
  delivery: () => restaurantInstance.get("/api/restaurant/analytics/delivery"),
  payments: () => restaurantInstance.get("/api/restaurant/analytics/payments"),
  report: (period: "daily" | "weekly" | "monthly") =>
    restaurantInstance.get("/api/restaurant/analytics/report", {
      params: { period },
    }),
};

// ── Notifications (port 3007) ────────────────────────────────────────────────
export const notificationApi = {
  list: (page = 1, limit = 20) =>
    notificationInstance.get("/api/notification/notifications", {
      params: { page, limit },
    }),
  markRead: (id: string) =>
    notificationInstance.patch(`/api/notification/notifications/${id}/read`),
  markAllRead: () =>
    notificationInstance.patch("/api/notification/notifications/read-all"),
};

// ── Restaurant categories (public, restaurant-service) ───────────────────────
export const categoriesApi = {
  list: () => restaurantInstance.get("/api/restaurant/categories"),
};

// ── Orders (port 3001) ────────────────────────────────────────────────────────
const ORDER_URL = process.env.NEXT_PUBLIC_ORDER_URL || "http://localhost:3001";
export const orderInstance = axios.create({ baseURL: ORDER_URL, headers: { "Content-Type": "application/json" } });
orderInstance.interceptors.request.use(attachToken);
orderInstance.interceptors.response.use((res) => res, (err) => handle401(err, orderInstance));
export const ordersApi = {
  getAll:       (params?: object)          => orderInstance.get("/api/order/orders", { params }),
  getOne:       (id: string)               => orderInstance.get(`/api/order/orders/${id}`),
  updateStatus: (id: string, data: object) => orderInstance.patch(`/api/order/orders/${id}/status`, data),
  updatePaymentStatus: (id: string, data: { paymentStatus: "paid" | "unpaid"; note?: string }) =>
    orderInstance.patch(`/api/order/orders/${id}/payment-status`, data),
  getChat:      (orderId: string)          => orderInstance.get(`/api/order/orders/${orderId}/chat`),
  sendChat:     (orderId: string, content: string) => orderInstance.post(`/api/order/orders/${orderId}/chat`, { content }),
  getReceipt:   (orderId: string)          => orderInstance.get(`/api/order/orders/${orderId}/receipt`),
  getPaymentProof: (orderId: string)       => orderInstance.get(`/api/order/orders/${orderId}/payment-proof`),
  assignDelivery: (orderId: string, deliveryAgentId: string) =>
    orderInstance.patch(`/api/order/orders/${orderId}/delivery`, { deliveryAgentId }),
};

// ── POS (port 3001) ───────────────────────────────────────────────────────────
export const posApi = {
  listOpen: (restaurantId: string) =>
    orderInstance.get("/api/order/pos/orders", { params: { restaurantId } }),
  create: (data: object) => orderInstance.post("/api/order/pos/orders", data),
  addItem: (id: string, data: object) =>
    orderInstance.post(`/api/order/pos/orders/${id}/items`, data),
  updateItem: (id: string, itemId: string, data: object) =>
    orderInstance.patch(`/api/order/pos/orders/${id}/items/${itemId}`, data),
  removeItem: (id: string, itemId: string) =>
    orderInstance.delete(`/api/order/pos/orders/${id}/items/${itemId}`),
  setDiscount: (id: string, discountAmount: number) =>
    orderInstance.patch(`/api/order/pos/orders/${id}/discount`, { discountAmount }),
  addPayment: (id: string, data: object) =>
    orderInstance.post(`/api/order/pos/orders/${id}/payments`, data),
  close: (id: string, data: object) =>
    orderInstance.post(`/api/order/pos/orders/${id}/close`, data),
  reopen: (id: string) =>
    orderInstance.post(`/api/order/pos/orders/${id}/reopen`),
  accept: (id: string) =>
    orderInstance.post(`/api/order/pos/orders/${id}/accept`),
  reject: (id: string, reason?: string) =>
    orderInstance.post(`/api/order/pos/orders/${id}/reject`, { reason }),
  finish: (id: string) =>
    orderInstance.post(`/api/order/pos/orders/${id}/finish`),
  void: (id: string, data: { reason?: string } = {}) =>
    orderInstance.post(`/api/order/pos/orders/${id}/void`, data),
  updatePayment: (
    id: string,
    splitId: string,
    data: { reference?: string; payerName?: string; paidAt?: string },
  ) => orderInstance.patch(`/api/order/pos/orders/${id}/payments/${splitId}`, data),
  print: (id: string, target: "kitchen" | "cashier" | "both" = "both") =>
    orderInstance.post(`/api/order/pos/orders/${id}/print`, undefined, {
      params: { target },
    }),
};

// ── Accounting (Tier 1: expenses + revenue + net profit) ─────────────────────
export const accountingApi = {
  summary: (params: { period?: "today" | "week" | "month" | "custom"; from?: string; to?: string } = {}) =>
    restaurantInstance.get("/api/restaurant/accounting/summary", { params }),
  listExpenses: (params: { category?: string; from?: string; to?: string } = {}) =>
    restaurantInstance.get("/api/restaurant/expenses", { params }),
  createExpense: (data: { amount: number; category: string; description?: string; occurredAt?: string }) =>
    restaurantInstance.post("/api/restaurant/expenses", data),
  updateExpense: (id: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/expenses/${id}`, data),
  deleteExpense: (id: string) =>
    restaurantInstance.delete(`/api/restaurant/expenses/${id}`),
};

// ── Inventory (Tier 1: items + movements + low-stock alerts) ─────────────────
export const inventoryApi = {
  summary: () => restaurantInstance.get("/api/restaurant/inventory/summary"),
  listItems: () => restaurantInstance.get("/api/restaurant/inventory/items"),
  createItem: (data: {
    name: string;
    sku?: string;
    unit: string;
    currentQuantity?: number;
    reorderThreshold?: number;
    unitCost?: number;
    isActive?: boolean;
  }) => restaurantInstance.post("/api/restaurant/inventory/items", data),
  updateItem: (id: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/inventory/items/${id}`, data),
  deleteItem: (id: string) =>
    restaurantInstance.delete(`/api/restaurant/inventory/items/${id}`),
  recordMovement: (
    itemId: string,
    data: { type: "in" | "out" | "adjustment"; quantity: number; unitCost?: number; note?: string },
  ) => restaurantInstance.post(`/api/restaurant/inventory/items/${itemId}/movements`, data),
  listMovements: (params: { itemId?: string; limit?: number } = {}) =>
    restaurantInstance.get("/api/restaurant/inventory/movements", { params }),
};

// ── Restaurant tables (POS QR-ordering) ───────────────────────────────────────
export const tablesApi = {
  list: () => restaurantInstance.get("/api/restaurant/tables"),
  create: (data: { number: string; capacity?: number; section?: string; isActive?: boolean }) =>
    restaurantInstance.post("/api/restaurant/tables", data),
  update: (id: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/tables/${id}`, data),
  remove: (id: string) =>
    restaurantInstance.delete(`/api/restaurant/tables/${id}`),
  regenerateQr: (id: string) =>
    restaurantInstance.post(`/api/restaurant/tables/${id}/regenerate-qr`),
};

// ── Menus / Sections / Meals / Option groups / Options (restaurant-service) ───
// All live under the restaurant service on port 3003.
export const menuApi = {
  // Menus
  listMenus: () => restaurantInstance.get("/api/restaurant/menus"),
  createMenu: (data: object) =>
    restaurantInstance.post("/api/restaurant/menus", data),
  updateMenu: (menuId: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/menus/${menuId}`, data),
  deleteMenu: (menuId: string) =>
    restaurantInstance.delete(`/api/restaurant/menus/${menuId}`),

  reorderMenus: (orderedIds: string[]) =>
    restaurantInstance.patch(`/api/restaurant/menus/reorder`, { orderedIds }),

  // Sections (list/create are menu-scoped; update/delete are flat)
  listSections: (menuId: string) =>
    restaurantInstance.get(`/api/restaurant/menus/${menuId}/sections`),
  createSection: (menuId: string, data: object) =>
    restaurantInstance.post(`/api/restaurant/menus/${menuId}/sections`, data),
  updateSection: (sectionId: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/sections/${sectionId}`, data),
  deleteSection: (sectionId: string) =>
    restaurantInstance.delete(`/api/restaurant/sections/${sectionId}`),
  reorderSections: (menuId: string, orderedIds: string[]) =>
    restaurantInstance.patch(
      `/api/restaurant/menus/${menuId}/sections/reorder`,
      { orderedIds },
    ),
};

export const mealsApi = {
  list: (sectionId: string) =>
    restaurantInstance.get(`/api/restaurant/sections/${sectionId}/meals`),
  create: (data: object) =>
    restaurantInstance.post("/api/restaurant/meals", data),
  update: (mealId: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/meals/${mealId}`, data),
  delete: (mealId: string) =>
    restaurantInstance.delete(`/api/restaurant/meals/${mealId}`),
  // Backend flips the flag server-side; no body needed.
  toggleAvailability: (mealId: string) =>
    restaurantInstance.patch(
      `/api/restaurant/meals/${mealId}/toggle-availability`,
    ),
  reorder: (sectionId: string, orderedIds: string[]) =>
    restaurantInstance.patch(
      `/api/restaurant/sections/${sectionId}/meals/reorder`,
      { orderedIds },
    ),
  generateAiImage: (mealId: string) =>
    restaurantInstance.post(`/api/restaurant/meals/${mealId}/ai-image`),
  // AI menu copywriting — Arabic description from name (+ optional price/section).
  generateCopy: (data: { name: string; price?: number; sectionName?: string }) =>
    restaurantInstance.post("/api/restaurant/ai/meal-copy", data),

  // Recipe (bill-of-materials): which inventory items a meal consumes per unit.
  getRecipe: (mealId: string) =>
    restaurantInstance.get(`/api/restaurant/meals/${mealId}/recipe`),
  setRecipe: (
    mealId: string,
    lines: { inventoryItemId: string; quantity: number }[],
  ) => restaurantInstance.put(`/api/restaurant/meals/${mealId}/recipe`, { lines }),
};

export const aiVoiceApi = {
  // Arabic ElevenLabs voice announcement for an order-status change → MP3 blob.
  orderVoice: (data: { status: string; orderNumber?: string }) =>
    restaurantInstance.post("/api/restaurant/ai/order-voice", data, {
      responseType: "blob",
    }),
};

export const optionGroupsApi = {
  list: (mealId: string) =>
    restaurantInstance.get(`/api/restaurant/meals/${mealId}/option-groups`),
  create: (mealId: string, data: object) =>
    restaurantInstance.post(
      `/api/restaurant/meals/${mealId}/option-groups`,
      data,
    ),
  update: (groupId: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/option-groups/${groupId}`, data),
  delete: (groupId: string) =>
    restaurantInstance.delete(`/api/restaurant/option-groups/${groupId}`),
};

// ── AI — Smart Menu Import ───────────────────────────────────────────────────
export const aiMenuImportApi = {
  /** Multipart, field name `image`. Returns { data: MenuExtraction }. */
  analyze: (image: File) => {
    const fd = new FormData();
    fd.append("image", image);
    return restaurantInstance.post(
      "/api/restaurant/ai/menu-import/analyze",
      fd,
    );
  },
  /** Persists the (optionally edited) extraction. */
  apply: (data: {
    targetMenuId?: string;
    menuName?: string;
    extraction: unknown;
  }) =>
    restaurantInstance.post("/api/restaurant/ai/menu-import/apply", data),
};

export const optionsApi = {
  list: (groupId: string) =>
    restaurantInstance.get(
      `/api/restaurant/option-groups/${groupId}/options`,
    ),
  create: (groupId: string, data: object) =>
    restaurantInstance.post(
      `/api/restaurant/option-groups/${groupId}/options`,
      data,
    ),
  update: (optionId: string, data: object) =>
    restaurantInstance.patch(`/api/restaurant/options/${optionId}`, data),
  delete: (optionId: string) =>
    restaurantInstance.delete(`/api/restaurant/options/${optionId}`),
};

// ── Support tickets (manager-service, port 3006) ─────────────────────────────
// Restaurant owners can file tickets; the admin panel reads/resolves them.
import type {
  CreateSupportTicketPayload,
  SupportTicket,
} from "@/types/support.types";

export function unwrapManager<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const supportApi = {
  create: (payload: CreateSupportTicketPayload) =>
    managerInstance.post<{ data: SupportTicket } | SupportTicket>(
      "/api/manager/admin/support/tickets",
      payload,
    ),
};

