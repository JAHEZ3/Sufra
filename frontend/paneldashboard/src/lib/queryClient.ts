import { QueryClient } from "@tanstack/react-query";
import type { ListAgentsParams } from "@/types/delivery.types";
import type { ListRestaurantsParams } from "@/types/restaurant.types";
import type { ListUsersParams } from "@/types/user.types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    root: ["users"] as const,
    list: (params?: ListUsersParams) => ["users", "list", params ?? {}] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    /** @deprecated use `list` with typed params */
    all: (params?: object) => ["users", "list", params ?? {}] as const,
    /** @deprecated use `detail` */
    one: (id: string) => ["users", "detail", id] as const,
  },
  restaurants: {
    root: ["restaurants"] as const,
    list: (params?: ListRestaurantsParams) =>
      ["restaurants", "list", params ?? {}] as const,
    detail: (id: string) => ["restaurants", "detail", id] as const,
    applications: ["restaurants", "applications"] as const,
    reviews: (id: string, page: number, limit: number) =>
      ["restaurants", "reviews", id, page, limit] as const,
    /** @deprecated use `list` with typed params */
    all: (params?: object) => ["restaurants", "list", params ?? {}] as const,
    /** @deprecated use `detail` */
    one: (id: string) => ["restaurants", "detail", id] as const,
  },
  deliveryAgents: {
    root: ["delivery-agents"] as const,
    list: (params?: ListAgentsParams) =>
      ["delivery-agents", "list", params ?? {}] as const,
    detail: (id: string) => ["delivery-agents", "detail", id] as const,
    applications: ["delivery-agents", "applications"] as const,
  },
  orders: {
    all: (params?: object) => ["orders", params] as const,
    one: (id: string) => ["orders", id] as const,
  },
  notifications: {
    root: ["notifications"] as const,
    list: (page: number, limit: number) =>
      ["notifications", "list", { page, limit }] as const,
  },
  categories: {
    root: ["categories"] as const,
    list: ["categories", "list"] as const,
  },
  settings: ["settings"] as const,
  support: {
    root: ["support"] as const,
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      ["support", "list", params ?? {}] as const,
    detail: (id: string) => ["support", "detail", id] as const,
  },
  stats: {
    overview: ["stats", "overview"] as const,
  },
  analytics: {
    root: ["analytics"] as const,
    publicStats: ["analytics", "public-stats"] as const,
    overview: ["analytics", "overview"] as const,
    orders: ["analytics", "orders"] as const,
    revenue: ["analytics", "revenue"] as const,
    restaurants: ["analytics", "restaurants"] as const,
    customers: ["analytics", "customers"] as const,
    delivery: ["analytics", "delivery"] as const,
    payments: ["analytics", "payments"] as const,
  },
};
