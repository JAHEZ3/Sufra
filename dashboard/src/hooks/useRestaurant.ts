"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { restaurantApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import { Restaurant, DashboardStats, SalesDataPoint, RestaurantHour } from "@/types/restaurant.types";
import { TopSellingMeal } from "@/types/menu.types";
import { UpdateRestaurantDto, UpdateSettingsDto, UpdateStoreStatusDto, RestaurantHourEntryDto } from "@/dto/restaurant.dto";

export function useRestaurant() {
  return useQuery<Restaurant>({
    queryKey: queryKeys.restaurant.me,
    queryFn: async () => {
      const res = await restaurantApi.getProfile();
      // Backend wraps responses in `{ data, message }`
      return (res.data?.data ?? res.data) as Restaurant;
    },
  });
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.restaurant.stats,
    queryFn: async () => {
      const res = await restaurantApi.getDashboardStats();
      // Backend wraps responses in `{ data, message }` — unwrap defensively.
      return (res.data?.data ?? res.data) as DashboardStats;
    },
    refetchInterval: 60 * 1000, // refetch every minute
  });
}

export function useSalesData(period: "daily" | "weekly" | "monthly" = "daily") {
  return useQuery<SalesDataPoint[]>({
    queryKey: queryKeys.restaurant.sales(period),
    queryFn: async () => {
      const res = await restaurantApi.getSalesData(period);
      return (res.data?.data ?? res.data ?? []) as SalesDataPoint[];
    },
  });
}

export function useTopMeals() {
  return useQuery<TopSellingMeal[]>({
    queryKey: queryKeys.restaurant.topMeals,
    queryFn: async () => {
      const res = await restaurantApi.getTopMeals();
      return (res.data?.data ?? res.data ?? []) as TopSellingMeal[];
    },
  });
}

export function useRestaurantHours() {
  return useQuery<RestaurantHour[]>({
    queryKey: queryKeys.restaurant.hours,
    queryFn: async () => { 
      const res = await restaurantApi.getHours();
      // Backend wraps responses in `{ data, message }`
      return (res.data?.data ?? res.data ?? []) as RestaurantHour[];
    },
  });
}

export function useUpdateRestaurant() {
  return useMutation({
    mutationFn: (data: UpdateRestaurantDto) => restaurantApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.me });
    },
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (data: UpdateSettingsDto) => restaurantApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.me });
    },
  });
}

export function useUpdateBranding() {
  return useMutation({
    mutationFn: (data: FormData) => restaurantApi.updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.me });
    },
  });
}

export function useToggleStoreStatus() {
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: (_data: UpdateStoreStatusDto) => restaurantApi.toggleOpen(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.me });
    },
  });
}

export function useSetHours() {
  return useMutation({
    mutationFn: (hours: RestaurantHourEntryDto[]) =>
      restaurantApi.setHours(hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.hours });
    },
  });
}
