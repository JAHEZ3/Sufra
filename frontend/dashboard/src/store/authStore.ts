"use client";

import { create } from "zustand";
import Cookies from "js-cookie";
import { AuthUser, RestaurantStatus } from "@/types/auth.types";

const COOKIE_OPTS = { expires: 30, sameSite: "strict" } as const;

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: Partial<AuthUser>) => void;
  setStatus: (status: RestaurantStatus) => void;
  logout: () => void;

  isAuthenticated: () => boolean;
  isProfileComplete: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,

  setTokens: (accessToken, refreshToken) => {
    if (!accessToken || !refreshToken) return;
    Cookies.set("refresh_token", refreshToken, COOKIE_OPTS);
    set({ accessToken });
  },

  setAccessToken: (accessToken) => {
    if (!accessToken) return;
    set({ accessToken });
  },

  setUser: (patch) => {
    const prev = get().user;
    const next = { ...(prev ?? {}), ...patch } as AuthUser;
    set({ user: next });
  },

  setStatus: (status) => {
    if (!status) return;
    const prev = get().user;
    set({ user: prev ? { ...prev, status } : ({ status } as AuthUser) });
  },

  logout: () => {
    Cookies.remove("refresh_token");
    set({ accessToken: null, user: null });
  },

  isAuthenticated: () => !!get().accessToken,

  isProfileComplete: () => {
    const { status } = get().user ?? {};
    return status === "active" || status === "pending_approval";
  },
}));
