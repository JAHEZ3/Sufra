"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { NotificationListResponse } from "@/types/notification.types";

const EMPTY: NotificationListResponse = { items: [], total: 0, unread: 0 };

/** notification-service sometimes returns the payload directly, sometimes wrapped in { data }. */
function unwrapNotifications(body: unknown): NotificationListResponse {
  if (body && typeof body === "object") {
    const root = body as { data?: unknown; items?: unknown };
    if (root.data && typeof root.data === "object" && "items" in (root.data as object)) {
      return root.data as NotificationListResponse;
    }
    if ("items" in root) return root as NotificationListResponse;
  }
  return EMPTY;
}

export function useNotifications(page = 1, limit = 20) {
  return useQuery<NotificationListResponse>({
    queryKey: queryKeys.notifications.list(page, limit),
    queryFn: async () => {
      const res = await notificationApi.list(page, limit);
      return unwrapNotifications(res.data);
    },
    refetchInterval: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.root });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.root });
    },
  });
}
