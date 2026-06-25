"use client";

/**
 * Plays a bell + shows a toast whenever the gateway pushes a new order
 * (`order:new`) or an order status change (`order:status`) to this restaurant.
 * Mount once inside the dashboard layout. Requires NEXT_PUBLIC_GATEWAY_URL.
 */

import { useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useToast } from "@/providers/ToastProvider";
import { bell, installAudioUnlock } from "@/lib/sounds";
import { aiVoiceApi } from "@/lib/api";

// Fetch an Arabic ElevenLabs announcement for a status change and play it.
// Best-effort: if the voice service isn't configured (no ELEVENLABS_API_KEY)
// or the request fails, we silently skip — the toast + bell still fired.
async function playOrderVoice(status: string, orderNumber?: string) {
  try {
    const res = await aiVoiceApi.orderVoice({ status, orderNumber });
    const url = URL.createObjectURL(res.data as Blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url));
    await audio.play().catch(() => URL.revokeObjectURL(url));
  } catch {
    /* voice disabled or failed — non-fatal */
  }
}

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  open: "قيد التحضير",
  preparing: "قيد التحضير",
  confirmed: "مؤكد",
  ready_for_pickup: "جاهز",
  ready: "جاهز",
  done: "مكتمل",
  delivered: "مكتمل",
  voided: "ملغي",
  cancelled: "ملغي",
};

type OrderEvent = { orderNumber?: string; table?: string | number; status?: string };

export function OrderAlerts() {
  const { on, connected, registerRestaurant } = useSocket();
  const { data: restaurant } = useRestaurant();
  const { success, info } = useToast();

  // The gateway can deliver the same event more than once (transport upgrade,
  // multiple rooms). Suppress repeats of the same order+event within a window
  // so we never show a duplicate toast/bell/voice for one change.
  const seenRef = useRef<Map<string, number>>(new Map());
  const isDuplicate = (key: string, windowMs = 4000) => {
    const now = Date.now();
    const last = seenRef.current.get(key);
    // Prune old keys so the map doesn't grow unbounded.
    for (const [k, t] of seenRef.current) {
      if (now - t > windowMs) seenRef.current.delete(k);
    }
    if (last && now - last < windowMs) return true;
    seenRef.current.set(key, now);
    return false;
  };

  // Join the restaurant room so this session (owner OR cashier) receives the
  // gateway's order:new / order:status broadcasts for this restaurant.
  useEffect(() => {
    if (connected && restaurant?.id) registerRestaurant(restaurant.id);
  }, [connected, restaurant?.id, registerRestaurant]);

  // Browsers block audio until a user gesture — unlock on first input.
  useEffect(() => installAudioUnlock(), []);

  useEffect(() => {
    const offNew = on("order:new", (...args: unknown[]) => {
      const d = (args[0] ?? {}) as OrderEvent;
      if (isDuplicate(`new:${d.orderNumber ?? ""}`)) return;
      bell();
      const where = d.table ? `طاولة ${d.table}` : "طلب جديد";
      success("طلب جديد 🔔", `${where}${d.orderNumber ? ` · #${d.orderNumber}` : ""}`);
    });
    const offStatus = on("order:status", (...args: unknown[]) => {
      const d = (args[0] ?? {}) as OrderEvent;
      if (isDuplicate(`status:${d.orderNumber ?? ""}:${d.status ?? ""}`)) return;
      bell();
      const label = (d.status && STATUS_AR[d.status]) || d.status || "";
      info("تحديث حالة الطلب 🔔", `${d.orderNumber ? `#${d.orderNumber} · ` : ""}${label}`);
      // Speak the new status in Arabic (ElevenLabs) — on every status change.
      if (d.status) {
        void playOrderVoice(d.status, d.orderNumber ? String(d.orderNumber) : undefined);
      }
    });
    return () => {
      offNew?.();
      offStatus?.();
    };
  }, [on, success, info]);

  return null;
}
