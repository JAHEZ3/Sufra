"use client";

import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { RestaurantCategory } from "@/types/category.types";

// restaurant-service may return either a raw array or { data: [...] }
function unwrapCategories(body: unknown): RestaurantCategory[] {
  if (Array.isArray(body)) return body as RestaurantCategory[];
  if (body && typeof body === "object") {
    const root = body as { data?: unknown };
    if (Array.isArray(root.data)) return root.data as RestaurantCategory[];
  }
  return [];
}

export function useCategories() {
  return useQuery<RestaurantCategory[]>({
    queryKey: queryKeys.categories.list,
    queryFn: async () => {
      const res = await categoriesApi.list();
      return unwrapCategories(res.data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
