"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, unwrap } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  CreateCategoryPayload,
  RestaurantCategory,
  UpdateCategoryPayload,
} from "@/types/category.types";

/** restaurant-service returns categories either as a raw array or wrapped in { data }. */
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
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) =>
      categoriesApi.create(payload).then(unwrap),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.root }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      categoriesApi.update(id, payload).then(unwrap),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.root }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id).then(unwrap),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.root }),
  });
}
