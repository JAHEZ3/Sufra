"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";

interface DriverLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

interface UseOrderTrackingResult {
  driver: DriverLocation | null;
  connected: boolean;
  /** ms since last update, used to fade the marker when stream goes quiet. */
  stalenessMs: number;
  isStale: boolean;
}

const STALE_AFTER_MS = 15_000;

/**
 * Subscribes to `delivery:location` for a single order. Joins the order room
 * on mount (so the gateway routes events here), leaves on unmount. The hook
 * is safe to call with `orderId === null/undefined` — it short-circuits and
 * returns a null driver, useful when the dialog hasn't opened yet.
 */
export function useOrderTracking(orderId: string | null | undefined): UseOrderTrackingResult {
  const { on, joinOrder, leaveOrder, connected } = useSocket();
  const [driver, setDriver] = useState<DriverLocation | null>(null);
  const [tick, setTick] = useState(0);

  // Bump every 5s so consumers can react to staleness without a synthetic event.
  useEffect(() => {
    if (!driver) return;
    const id = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, [driver]);

  useEffect(() => {
    if (!orderId) return;
    joinOrder(orderId);

    const off = on("delivery:location", (...args: unknown[]) => {
      const payload = args[0] as
        | { lat?: number; lng?: number; timestamp?: number; orderId?: string }
        | undefined;
      if (
        !payload ||
        typeof payload.lat !== "number" ||
        typeof payload.lng !== "number"
      ) {
        return;
      }
      // Gateway broadcasts to the room, but we still double-check in case a
      // stale handler from a previous order is still attached on the singleton.
      if (payload.orderId && payload.orderId !== orderId) return;
      setDriver({
        lat: payload.lat,
        lng: payload.lng,
        timestamp: payload.timestamp ?? Date.now(),
      });
    });

    return () => {
      off();
      leaveOrder(orderId);
    };
  }, [orderId, on, joinOrder, leaveOrder]);

  const stalenessMs = driver ? Date.now() - driver.timestamp : Infinity;
  return {
    driver,
    connected,
    stalenessMs,
    isStale: stalenessMs >= STALE_AFTER_MS,
    // Touch `tick` so the hook recomputes staleness every 5s.
    ...({ _tick: tick } as Record<string, never>),
  };
}
