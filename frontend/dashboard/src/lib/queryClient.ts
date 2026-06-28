import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s
      gcTime: 5 * 60 * 1000,       // 5m
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Query keys
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
    sessions: ["auth", "sessions"] as const,
  },
  restaurant: {
    me: ["restaurant", "me"] as const,
    stats: ["restaurant", "stats"] as const,
    sales: (period: string) => ["restaurant", "sales", period] as const,
    topMeals: ["restaurant", "top-meals"] as const,
    hours: ["restaurant", "hours"] as const,
  },
  orders: {
    all: (filters?: object) => ["orders", filters] as const,
    detail: (id: string) => ["orders", id] as const,
  },
  menu: {
    all: ["menu"] as const,
    optionGroups: (mealId: string) => ["menu", "option-groups", mealId] as const,
    options: (groupId: string) => ["menu", "options", groupId] as const,
  },
  analytics: {
    overview: ["analytics", "overview"] as const,
    orders: ["analytics", "orders"] as const,
    revenue: ["analytics", "revenue"] as const,
    topMeals: ["analytics", "top-meals"] as const,
    customers: ["analytics", "customers"] as const,
    ratings: ["analytics", "ratings"] as const,
    reviews: (page: number, limit: number) =>
      ["analytics", "reviews", page, limit] as const,
    restaurantReviews: (page: number, limit: number, sort: string) =>
      ["analytics", "restaurant-reviews", page, limit, sort] as const,
    restaurantRatingsSummary: ["analytics", "restaurant-ratings-summary"] as const,
    delivery: ["analytics", "delivery"] as const,
    payments: ["analytics", "payments"] as const,
    report: (period: string) => ["analytics", "report", period] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (page: number, limit: number) =>
      ["notifications", "list", page, limit] as const,
  },
  categories: {
    list: ["categories", "list"] as const,
  },
};
