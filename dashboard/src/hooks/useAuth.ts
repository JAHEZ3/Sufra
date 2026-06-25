"use client";

import { useMutation } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { authApi, normalizeTokens } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";
import { navigateTo } from "@/lib/navigation";

export function useLogin() {
  const { setTokens } = useAuthStore();
  console.log("useLogin hook initialized"); // Debug log
  return useMutation({
    mutationFn: async ({ phone, password }: { phone: string; password: string }) => {
      const res = await authApi.loginRestaurant(phone, password);
      return normalizeTokens(res.data);
    },
    onSuccess: (tokens) => {
      if (!tokens) return;
      setTokens(tokens.accessToken, tokens.refreshToken);
      // StatusGuard on /dashboard will redirect based on profile status
      navigateTo("/dashboard");
    },
  });
}

export function useRegister() {
  const { setTokens } = useAuthStore();
  return useMutation({
    mutationFn: async (data: { phone: string; password: string; restaurantName: string }) => {
      const res = await authApi.registerRestaurant(data);
      return normalizeTokens(res.data);
    },
    onSuccess: (tokens) => {
      if (!tokens) return;
      // One-step signup → account is active, log straight into the dashboard.
      setTokens(tokens.accessToken, tokens.refreshToken);
      navigateTo("/dashboard");
    },
  });
}

export function useVerifyOtp() {
  const { setTokens } = useAuthStore();

  return useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const res = await authApi.verifyOtp(phone, otp);
      return normalizeTokens(res.data);
    },
    onSuccess: (tokens) => {
      if (!tokens) return;
      setTokens(tokens.accessToken, tokens.refreshToken);
      // Navigation is handled by the consumer so UI can show a "done" step first
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (phone: string) => authApi.resendOtp(phone),
  });
}

export function useCompleteProfile() {
  const { setTokens, setAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { restaurantApi } = await import("@/lib/api");
      const res = await restaurantApi.completeProfile(formData);
      return res.data;
    },
    onSuccess: (data) => {
      const tokens = normalizeTokens(data);
      if (tokens) {
        setTokens(tokens.accessToken, tokens.refreshToken);
      } else {
        const inner = (data as { data?: Record<string, unknown> } | undefined)?.data ?? data;
        const lone = inner as { accessToken?: string; access_token?: string } | undefined;
        const accessOnly = lone?.accessToken ?? lone?.access_token;
        if (accessOnly) setAccessToken(accessOnly);
      }
      // Profile completion now activates the account immediately (no approval).
      navigateTo("/dashboard");
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = Cookies.get("refresh_token");
      if (refreshToken) {
        try { await authApi.logout(refreshToken); } catch { /* ignore */ }
      }
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      navigateTo("/login");
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (phone: string) => authApi.forgotPassword(phone),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ phone, otp, newPassword }: { phone: string; otp: string; newPassword: string }) =>
      authApi.resetPassword(phone, otp, newPassword),
  });
}

export function useAuth() {
  const login           = useLogin();
  const register        = useRegister();
  const verifyOtp       = useVerifyOtp();
  const resendOtp       = useResendOtp();
  const completeProfile = useCompleteProfile();
  const logout          = useLogout();
  const forgotPassword  = useForgotPassword();
  const resetPassword   = useResetPassword();

  return { login, register, verifyOtp, resendOtp, completeProfile, logout, forgotPassword, resetPassword };
}
