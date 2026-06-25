"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { restaurantApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { navigateTo } from "@/lib/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { RestaurantStatus } from "@/types/auth.types";

function routeForStatus(status: RestaurantStatus | null | undefined): string {
  switch (status) {
    case "suspended": return "/suspended";
    case "closed":    return "/closed";
    // active / pending_approval / null → straight into the dashboard.
    default:          return "/dashboard";
  }
}

function pathAllowedForStatus(path: string, status: RestaurantStatus | null): boolean {
  if (status === "suspended") return path.startsWith("/suspended");
  if (status === "closed")    return path.startsWith("/closed");
  // active / pending_approval / null → anything except the status-trap pages.
  return !["/pending-approval", "/suspended", "/closed"].some((p) => path.startsWith(p));
}

export function StatusGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setUser, logout } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await restaurantApi.getProfile();
        if (cancelled) return;
        const payload = (res.data?.data ?? res.data) as { status?: RestaurantStatus; name?: string | null } | undefined;
        const status = payload?.status ?? null;

        if (status) setUser({ status });

        if (!pathAllowedForStatus(pathname, status)) {
          navigateTo(routeForStatus(status));
          return;
        }
        setReady(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 404 → no restaurant profile yet; let them into the app anyway
        // (registration now always creates one, so this is just a safety net).
        if (status === 404) {
          setReady(true);
          return;
        }
        // 401 is handled by the axios refresh interceptor; if it reaches here the session is dead
        if (status === 401) {
          logout();
          navigateTo("/login");
          return;
        }
        // Other errors — allow render; individual pages can show their own error states
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname, setUser, logout]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
