"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authApi,
} from "@/lib/api";
import { decodeJwt, isJwtExpired } from "@/lib/jwt";
import { queryClient, queryKeys } from "@/lib/queryClient";
import type { AdminUser, LoginCredentials } from "@/types/auth.types";

function managerFromToken(token: string | undefined): AdminUser | null {
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload?.sub || !payload.role) return null;
  return {
    id: payload.sub,
    email: payload.email ?? "",
    role: payload.role,
  };
}

/** Reads the currently-authenticated manager from the stored access token. */
export function useMe() {
  return useQuery<AdminUser | null>({
    queryKey: queryKeys.auth.me,
    queryFn: () => {
      const token = Cookies.get(ACCESS_TOKEN_COOKIE);
      if (!token || isJwtExpired(token)) return null;
      return managerFromToken(token);
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await authApi.loginManager(credentials);
      return res.data.data;
    },
    onSuccess: (tokens) => {
      Cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
        expires: 7,
        sameSite: "lax",
      });
      Cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
        expires: 30,
        sameSite: "lax",
      });
      queryClient.setQueryData(
        queryKeys.auth.me,
        managerFromToken(tokens.accessToken),
      );
      router.push("/panel/overview");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE);
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => undefined);
      }
    },
    onSettled: () => {
      Cookies.remove(ACCESS_TOKEN_COOKIE);
      Cookies.remove(REFRESH_TOKEN_COOKIE);
      queryClient.clear();
      router.push("/login");
    },
  });
}
