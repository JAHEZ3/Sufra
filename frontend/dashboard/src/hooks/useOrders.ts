"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ordersApi, posApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import {
  Order,
  PaginatedOrders,
  OrderFilters,
  normalizeOrder,
} from "@/types/order.types";
import { UpdateOrderStatusDto } from "@/dto/order.dto";

// Order-service responds with `{ data: { data: Order[], total, page, limit, pages }, message }`.
// Axios puts the body on `res.data` so the inner pagination wrapper lives at `res.data.data`.
function unwrapPaginated(res: { data: unknown }): PaginatedOrders {
  const body = res.data as
    | { data?: { data?: unknown[]; total?: number; page?: number; limit?: number } }
    | undefined;
  const inner = body?.data ?? (body as unknown as { data?: unknown[]; total?: number; page?: number; limit?: number });
  const rows = Array.isArray(inner?.data) ? inner!.data : [];
  return {
    data: rows.map((r) => normalizeOrder(r as Parameters<typeof normalizeOrder>[0])),
    total: typeof inner?.total === "number" ? inner.total : rows.length,
    page: typeof inner?.page === "number" ? inner.page : 1,
    limit: typeof inner?.limit === "number" ? inner.limit : rows.length,
  };
}

function unwrapOne(res: { data: unknown }): Order {
  const body = res.data as { data?: unknown } | undefined;
  const raw = (body?.data ?? body) as Parameters<typeof normalizeOrder>[0];
  return normalizeOrder(raw);
}

export function useOrders(filters?: OrderFilters) {
  return useQuery<PaginatedOrders>({
    queryKey: queryKeys.orders.all(filters),
    queryFn: async () => unwrapPaginated(await ordersApi.getAll(filters)),
    enabled: !!filters?.restaurantId,
    refetchInterval: 30 * 1000, // safety net — sockets do the heavy lifting
  });
}

export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async () => unwrapOne(await ordersApi.getOne(id)),
    enabled: !!id,
  });
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderStatusDto }) =>
      ordersApi.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.stats });
    },
  });
}

/**
 * Restaurant owner / manager flips an order's payment status after verifying
 * the customer's uploaded receipt. Backend rejects "paid" when there's no
 * proof on file (for online orders).
 */
export function useUpdatePaymentStatus() {
  return useMutation({
    mutationFn: ({
      id,
      paymentStatus,
      note,
    }: {
      id: string;
      paymentStatus: "paid" | "unpaid";
      note?: string;
    }) => ordersApi.updatePaymentStatus(id, { paymentStatus, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.stats });
    },
  });
}

export function useVoidPosOrder() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      posApi.void(id, reason ? { reason } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.stats });
    },
  });
}

export function useFinishPosOrder() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => posApi.finish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.stats });
    },
  });
}
