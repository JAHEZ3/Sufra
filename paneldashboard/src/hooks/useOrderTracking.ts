"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useJoinOrderRoom,
  useSocketEvent,
  useSocketStatus,
} from "./useSocket";

interface DriverLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

interface UseOrderTrackingResult {
  driver: DriverLocation | null;
  connected: boolean;
  stalenessMs: number;
  isStale: boolean;
}

const STALE_AFTER_MS = 15_000;

/**
 * Subscribes to `delivery:location` for one order. Joins the order room on
 * mount, leaves on unmount. Pass `null` to disable (e.g. when the dialog is
 * closed) so we don't hold rooms we no longer need.
 *
 * Built on the shared `socketService` so it reuses the single connection,
 * inherits error handling, and rejoins after reconnect automatically.
 */
export function useOrderTracking(
  orderId: string | null | undefined,
): UseOrderTrackingResult {
  const status = useSocketStatus();
  useJoinOrderRoom(orderId, !!orderId);

  const [driver, setDriver] = useState<DriverLocation | null>(null);
  const [tick, setTick] = useState(0);

  useSocketEvent(
    "delivery:location",
    (payload: unknown) => {
      const p = payload as
        | { lat?: number; lng?: number; timestamp?: number; orderId?: string }
        | undefined;
      if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return;
      // Ignore events bound for other orders — the singleton routes everything
      // through one listener so we filter here.
      if (orderId && p.orderId && p.orderId !== orderId) return;
      setDriver({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp ?? Date.now(),
      });
    },
    !!orderId,
  );

  // Recompute staleness every 5s — drives the "stale" badge without needing
  // a fake event.
  useEffect(() => {
    if (!driver) return;
    const id = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, [driver]);

  return useMemo<UseOrderTrackingResult>(() => {
    const now = Date.now();
    const stalenessMs = driver ? now - driver.timestamp : Infinity;
    return {
      driver,
      connected: status === "open",
      stalenessMs,
      isStale: stalenessMs >= STALE_AFTER_MS,
    };
    // `tick` is intentional in the dep list — it drives the 5s recompute of
    // staleness without a synthetic event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, status, tick]);
}
