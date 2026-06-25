"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restaurantsApi, unwrap, type RestaurantReviewsList } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  ChangeRestaurantStatusPayload,
  ListRestaurantsParams,
  RejectApplicationPayload,
  UpdateRestaurantPayload,
} from "@/types/restaurant.types";
import type { RestaurantFull } from "@/types/restaurant-full.types";

// ─── Applications ────────────────────────────────────────────────────────────

export function useRestaurantApplications() {
  return useQuery({
    queryKey: queryKeys.restaurants.applications,
    queryFn: () => restaurantsApi.listApplications().then(unwrap),
  });
}

export function useApproveRestaurantApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      restaurantsApi.approveApplication(id).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.applications });
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
    },
  });
}

export function useRejectRestaurantApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectApplicationPayload }) =>
      restaurantsApi.rejectApplication(id, payload).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.applications });
    },
  });
}

// ─── Restaurants ─────────────────────────────────────────────────────────────

export function useRestaurants(params?: ListRestaurantsParams) {
  return useQuery({
    queryKey: queryKeys.restaurants.list(params),
    queryFn: () => restaurantsApi.list(params).then(unwrap),
  });
}

export function useRestaurant(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.restaurants.detail(id ?? ""),
    queryFn: () => restaurantsApi.getOne(id as string).then(unwrap),
    enabled: !!id,
  });
}

export function useRestaurantFull(id: string | undefined) {
  return useQuery<RestaurantFull>({
    queryKey: ["restaurants", "full", id ?? ""] as const,
    queryFn: async () => {
      const res = await restaurantsApi.getFull(id as string);
      return unwrap(res) as RestaurantFull;
    },
    enabled: !!id,
  });
}

export function useUpdateRestaurant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRestaurantPayload) =>
      restaurantsApi.update(id, payload).then(unwrap),
    onSuccess: (restaurant) => {
      qc.setQueryData(queryKeys.restaurants.detail(id), restaurant);
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
    },
  });
}

export function useChangeRestaurantStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChangeRestaurantStatusPayload) =>
      restaurantsApi.changeStatus(id, payload).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
    },
  });
}

export function useDeleteRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantsApi.delete(id).then(unwrap),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.restaurants.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
    },
  });
}

export function useRestaurantReviews(
  id: string | undefined,
  page = 1,
  limit = 20,
) {
  return useQuery<RestaurantReviewsList>({
    queryKey: queryKeys.restaurants.reviews(id ?? "", page, limit),
    queryFn: () =>
      restaurantsApi.listReviews(id as string, page, limit).then(unwrap),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}
