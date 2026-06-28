"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi, unwrap } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";

export function usePublicStats() {
  return useQuery({
    queryKey: queryKeys.analytics.publicStats,
    queryFn: () => analyticsApi.publicStats().then(unwrap),
    staleTime: 1000 * 60 * 5,
    retry: 0,
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: queryKeys.analytics.overview,
    queryFn: () => analyticsApi.overview().then(unwrap),
  });
}

export function useOrdersAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.orders,
    queryFn: () => analyticsApi.orders().then(unwrap),
  });
}

export function useRevenueAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.revenue,
    queryFn: () => analyticsApi.revenue().then(unwrap),
  });
}

export function useRestaurantsAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.restaurants,
    queryFn: () => analyticsApi.restaurants().then(unwrap),
  });
}

export function useCustomersAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.customers,
    queryFn: () => analyticsApi.customers().then(unwrap),
  });
}

export function useDeliveryAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.delivery,
    queryFn: () => analyticsApi.delivery().then(unwrap),
  });
}

export function usePaymentsAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.payments,
    queryFn: () => analyticsApi.payments().then(unwrap),
  });
}
