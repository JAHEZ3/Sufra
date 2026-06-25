"use client";

import { useOrdersRealtime, useSocketBootstrap } from "@/hooks/useSocket";

/**
 * Mounted once at the panel layout root. Has no DOM — its only job is to:
 *   1. Open the shared socket.io connection (once per app load).
 *   2. Subscribe to `order:new` / `order:status:updated` / `order:delivery:assigned`
 *      and invalidate the orders queries so every open list/dialog
 *      auto-refreshes when something changes server-side.
 *
 * Separated into its own client component so the surrounding
 * `panel/layout.tsx` can stay a server component.
 */
export default function RealtimeBoot() {
  useSocketBootstrap();
  useOrdersRealtime();
  return null;
}
