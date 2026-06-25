"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import type { NotificationListResponse } from "@/types/notification.types";
import { useSocket } from "./useSocket";

function unwrap<T>(payload: unknown): T {
  const root = payload as { data?: T } | T;
  if (root && typeof root === "object" && "data" in (root as object)) {
    return (root as { data: T }).data;
  }
  return root as T;
}

export function useNotifications(page = 1, limit = 20) {
  return useQuery<NotificationListResponse>({
    queryKey: queryKeys.notifications.list(page, limit),
    queryFn: async () =>
      unwrap<NotificationListResponse>((await notificationApi.list(page, limit)).data),
    refetchInterval: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/**
 * Subscribes to socket events that may produce a notification for the
 * current user (orders coming in, status changes, deliveries assigned, and
 * a generic notification:new event if the gateway ever emits one) and
 * invalidates the notifications query so the bell badge stays live.
 */
export function useNotificationSocket() {
  const { socket, on } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const refresh = () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });

    const offs = [
      on("notification:new", refresh),
      on("order:new", refresh),
      on("order:status", refresh),
      on("order:delivery:assigned", refresh),
    ];

    return () => offs.forEach((off) => off?.());
  }, [socket, on, qc]);
}
