"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { queryClient, queryKeys } from "@/lib/queryClient";
import type { SessionsResponse, SessionSummary } from "@/types/session.types";

export function useSessions() {
  return useQuery<SessionSummary[]>({
    queryKey: queryKeys.auth.sessions,
    queryFn: async () => {
      const refreshToken = Cookies.get("refresh_token");
      const res = await authApi.listSessions(refreshToken);
      // Backend wraps responses in `{ data, message }`; data is { items, total }
      const payload = (res.data?.data ?? res.data) as SessionsResponse;
      return payload.items ?? [];
    },
  });
}

export function useRevokeSession() {
  return useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
  });
}

export function useRevokeOtherSessions() {
  return useMutation({
    mutationFn: () => {
      const refreshToken = Cookies.get("refresh_token");
      if (!refreshToken) throw new Error("no_refresh_token");
      return authApi.revokeOtherSessions(refreshToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
  });
}
