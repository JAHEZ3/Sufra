"use client";

import { use, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { io, type Socket } from "socket.io-client";

// Pulls the localized message the server returns ({ message, statusCode, ... }).
function extractApiError(e: unknown): { message: string; status?: number } {
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError<{ message?: string | string[] }>;
    const raw = err.response?.data?.message;
    const msg = Array.isArray(raw) ? raw[0] : raw;
    return { message: msg ?? "تعذر إرسال الطلب", status: err.response?.status };
  }
  if (e instanceof Error) return { message: e.message };
  return { message: "تعذر إرسال الطلب" };
}

// Same-origin axios so requests hit the Next.js dev-server rewrites.
const scanClient = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json", "Accept-Language": "ar" },
  timeout: 10_000,
});

interface ScanMeal { id: string; name: string; basePrice: number | string; isAvailable?: boolean }
interface ScanSection { id: string; name: string; meals?: ScanMeal[] }
interface ScanMenu { id: string; name: string; sections?: ScanSection[] }
interface TableLookup {
  table: { id: string; number: string; section: string | null; capacity: number };
  restaurant: { id: string; name: string; logoUrl: string | null };
}
interface PublicMenuResponse {
  restaurant?: { id: string; name: string; logoUrl?: string | null };
  menus?: ScanMenu[];
}
interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  totalAmount: number;
  items: { name: string; quantity: number; totalPrice: number }[];
}

function unwrap<T>(payload: unknown): T {
  const root = payload as { data?: T } | T;
  if (root && typeof root === "object" && "data" in root) return (root as { data?: T }).data as T;
  return root as T;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("ar", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n);

// Live local-order status → customer-facing label + tracker step.
const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار تأكيد المطعم",
  open: "قيد التحضير",
  preparing: "قيد التحضير",
  done: "اكتمل طلبك",
  voided: "أُلغي الطلب",
};
const STEP_OF: Record<string, number> = { pending: 0, open: 1, preparing: 1, done: 2 };

// Bell via Web Audio — no asset. A single persistent AudioContext is reused and
// resumed on play; mobile browsers suspend a fresh context created long after
// the last tap, so reuse + unlock-on-gesture is what makes the delayed
// status-change bell actually ring.
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}
function playBell() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // two-tone "ding-dong"
    ([[988, now], [784, now + 0.18]] as const).forEach(([freq, start]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
      o.start(start); o.stop(start + 0.65);
    });
  } catch { /* audio not ready — never throw on a status update */ }
}

// Speak the status via the restaurant's ElevenLabs voice. Decoded + played
// through the *same* unlocked AudioContext as the bell, so it works on mobile
// after the first tap (a fresh <audio> element would be autoplay-blocked).
async function playVoice(status: string) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const res = await fetch(
      `/api/restaurant/public/order-voice?status=${encodeURIComponent(status)}`,
    );
    if (!res.ok) return; // 503 (key not set) / 400 (status without a phrase)
    const buf = await res.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.destination);
    src.start();
  } catch { /* best-effort — voice is a nicety, never block the update */ }
}

// Buzz the phone (Android; iOS ignores). Safe no-op when unsupported.
function vibrate() {
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* unsupported */ }
}

// OS-level notification (shows even if the tab is backgrounded). Requires the
// customer to have granted permission on a tap.
function notify(body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification("تحديث على طلبك 🔔", { body, tag: "sufra-order-status" });
  } catch { /* unsupported */ }
}

// ─── design palette (imported "Sufra QR Ordering" prototype) ──────────────────
// Default brand accent; overridden per-restaurant by `brandColor` (see below).
const BRAND_DEFAULT = "#1f8a5b";
const DARK = "#16201a";
const FONT = "'IBM Plex Sans Arabic', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', monospace";
const TINTS = ["#efe3cf", "#f0e8d2", "#e9efd9", "#f0ddd2", "#e6f0e2", "#ece2d6", "#dfe6ef", "#e8ddd6", "#f1e9da", "#e6e0d3"];
const tintFor = (id: string) => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
const stripe = (tint: string): CSSProperties => ({
  position: "absolute", inset: 0,
  background: `repeating-linear-gradient(45deg, ${tint} 0 12px, ${tint}bb 12px 24px)`,
});

type Screen = "menu" | "item" | "cart";

// Hoisted to module scope so they aren't re-created each render (which would
// remount children and drop focus from the cart's name/phone inputs).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" style={{ minHeight: "100dvh", maxWidth: 460, margin: "0 auto", background: "#f7f8f5", color: DARK, fontFamily: FONT, position: "relative", WebkitFontSmoothing: "antialiased" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`@keyframes sufpulse{0%{box-shadow:0 0 0 0 rgba(31,138,91,.45)}70%{box-shadow:0 0 0 12px rgba(31,138,91,0)}100%{box-shadow:0 0 0 0 rgba(31,138,91,0)}}`}</style>
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Shell><div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>{children}</div></Shell>
  );
}

export default function ScanOrderPage({
  params,
}: {
  params: Promise<{ restaurant: string; token: string }>;
}) {
  const { token } = use(params);
  // Persist the submitted order per-table so the tracking view survives the
  // customer closing/refreshing the page — they re-land on their live order
  // instead of a fresh menu.
  const storageKey = `sufra:scan-order:${token}`;

  const tableQuery = useQuery<TableLookup>({
    queryKey: ["scan-table", token],
    queryFn: async () => unwrap<TableLookup>((await scanClient.get(`/api/restaurant/public/tables/by-qr/${token}`)).data),
    retry: false,
  });

  const menuQuery = useQuery<PublicMenuResponse>({
    queryKey: ["scan-menu", tableQuery.data?.restaurant.id],
    queryFn: async () => unwrap<PublicMenuResponse>((await scanClient.get(`/api/restaurant/${tableQuery.data!.restaurant.id}`)).data),
    enabled: !!tableQuery.data?.restaurant.id,
    retry: false,
  });

  // Does this table already have an open bill? If so the customer is *adding*
  // to it — we show the already-sent items (read-only) and the submit appends.
  const activeOrderQuery = useQuery<ActiveOrder | null>({
    queryKey: ["scan-active-order", token],
    queryFn: async () =>
      unwrap<ActiveOrder | null>(
        (await scanClient.get(`/api/order/public/tables/${token}/active-order`)).data,
      ),
    enabled: !!token,
    refetchInterval: 8000,
  });
  const activeOrder = activeOrderQuery.data ?? null;

  const [cart, setCart] = useState<Record<string, { meal: ScanMeal; qty: number }>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  // Set when the customer explicitly leaves the tracker for the menu, so the
  // "table has an open order → show tracking" auto-resume doesn't bounce them
  // straight back.
  const [trackingDismissed, setTrackingDismissed] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [cat, setCat] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [itemQty, setItemQty] = useState(1);

  const subtotal = useMemo(() => Object.values(cart).reduce((s, e) => s + Number(e.meal.basePrice) * e.qty, 0), [cart]);
  const totalItems = useMemo(() => Object.values(cart).reduce((s, e) => s + e.qty, 0), [cart]);

  const addN = (meal: ScanMeal, n: number) =>
    setCart((c) => ({ ...c, [meal.id]: { meal, qty: (c[meal.id]?.qty ?? 0) + n } }));
  const add = (meal: ScanMeal) => addN(meal, 1);
  const remove = (mealId: string) =>
    setCart((c) => {
      const e = c[mealId];
      if (!e) return c;
      if (e.qty <= 1) { const { [mealId]: _drop, ...rest } = c; return rest; }
      return { ...c, [mealId]: { ...e, qty: e.qty - 1 } };
    });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await scanClient.post("/api/order/pos/scan-order", {
        qrToken: token,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: Object.values(cart).map(({ meal, qty }) => ({
          mealId: meal.id, mealName: meal.name, basePrice: Number(meal.basePrice), quantity: qty,
        })),
      });
      return unwrap<{ id: string; orderNumber: string }>(res.data);
    },
    onSuccess: (order) => {
      const so = { id: order.id, orderNumber: order.orderNumber };
      setSubmittedOrder(so);
      try { localStorage.setItem(storageKey, JSON.stringify(so)); } catch { /* private mode */ }
      setCart({});
      void activeOrderQuery.refetch();
    },
  });

  // Initial status — fetched ONCE when the order is opened/restored. Live
  // updates come over the WebSocket below (no polling interval).
  const statusQuery = useQuery<{ id: string; orderNumber: string; status: string }>({
    queryKey: ["scan-order-status", submittedOrder?.id],
    queryFn: async () =>
      unwrap<{ id: string; orderNumber: string; status: string }>(
        (await scanClient.get(`/api/order/public/orders/${submittedOrder!.id}/status`)).data,
      ),
    enabled: !!submittedOrder?.id,
    retry: false,
  });

  // Live status pushed over the socket (guest subscription to the order room).
  const [socketStatus, setSocketStatus] = useState<string | null>(null);
  useEffect(() => {
    const orderId = submittedOrder?.id;
    if (!orderId || typeof window === "undefined") return;
    setSocketStatus(null);
    // Connect straight to the api-gateway (Socket.IO host). Derive its URL from
    // the page host on port 3000 so it works on localhost AND over LAN from a
    // phone, without proxying Socket.IO through Next (which 404s the handshake).
    // Override with NEXT_PUBLIC_GATEWAY_URL if the gateway lives elsewhere.
    // Polling first (plain HTTP handshake), then upgrade to websocket.
    const gatewayUrl =
      process.env.NEXT_PUBLIC_GATEWAY_URL ||
      `${window.location.protocol}//${window.location.hostname}:3000`;
    const socket: Socket = io(gatewayUrl, {
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    socket.on("connect", () => socket.emit("order:track", { orderId }));
    socket.on("connect_error", (err) =>
      console.warn("[scan] socket connect_error:", err?.message),
    );
    socket.on("order:status", (payload: { orderId?: string; status?: string }) => {
      if (payload?.status && (!payload.orderId || payload.orderId === orderId)) {
        setSocketStatus(payload.status);
      }
    });
    return () => {
      socket.emit("order:leave", { orderId });
      socket.disconnect();
    };
  }, [submittedOrder?.id]);

  // Restore a previously-submitted order on mount (page was closed/refreshed).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; orderNumber?: string };
        if (parsed?.id && parsed?.orderNumber) {
          setSubmittedOrder({ id: parsed.id, orderNumber: parsed.orderNumber });
        }
      }
    } catch { /* ignore */ }
    // Run once for this table token.
  }, [storageKey]);

  // The table has an open (not-closed) order → land the customer on the live
  // tracker even on a fresh device with no saved order, unless they chose to
  // browse the menu (to add more). Closed tables fall through to the menu.
  useEffect(() => {
    if (
      !submittedOrder &&
      !trackingDismissed &&
      activeOrder?.id &&
      activeOrder?.orderNumber
    ) {
      setSubmittedOrder({ id: activeOrder.id, orderNumber: activeOrder.orderNumber });
    }
  }, [submittedOrder, trackingDismissed, activeOrder?.id, activeOrder?.orderNumber]);

  // If the restored order no longer exists (status lookup 404s) drop the stale
  // pointer and fall back to the menu.
  useEffect(() => {
    if (submittedOrder && statusQuery.isError) {
      setSubmittedOrder(null);
      prevStatusRef.current = null;
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [submittedOrder, statusQuery.isError, storageKey]);

  // Chime + banner whenever the kitchen advances the order's status. Socket
  // pushes win; the one-shot fetch only seeds the initial value.
  const liveStatus = socketStatus ?? statusQuery.data?.status;
  useEffect(() => {
    if (!liveStatus) return;
    if (prevStatusRef.current === null) { prevStatusRef.current = liveStatus; return; }
    if (prevStatusRef.current !== liveStatus) {
      prevStatusRef.current = liveStatus;
      const label = STATUS_LABEL[liveStatus] ?? liveStatus;
      playBell();          // chime (Web Audio)
      vibrate();           // buzz the phone (Android)
      notify(label);       // OS notification (if permitted)
      setStatusBanner(label); // in-page banner
      void playVoice(liveStatus); // spoken status (ElevenLabs, best-effort)
    }
  }, [liveStatus]);
  useEffect(() => {
    if (!statusBanner) return;
    const to = setTimeout(() => setStatusBanner(null), 5000);
    return () => clearTimeout(to);
  }, [statusBanner]);

  // Unlock audio on the first tap so the later status-change bell can ring
  // (mobile browsers block audio until a user gesture). Also ask for OS
  // notification permission here — it must be requested from a user gesture.
  useEffect(() => {
    const unlock = () => {
      getCtx();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch { /* unsupported */ }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const submitError = submit.isError ? extractApiError(submit.error) : null;
  const tableIsBusy = submitError?.status === 409;

  // ─── derived menu model ─────────────────────────────────────────────────────
  const sections = useMemo(
    () => (menuQuery.data?.menus ?? []).flatMap((m) => m.sections ?? []),
    [menuQuery.data],
  );
  const products = useMemo(
    () => sections.flatMap((s) => (s.meals ?? []).map((meal) => ({ ...meal, sectionId: s.id }))),
    [sections],
  );
  const shown = cat === "all" ? products : products.filter((p) => p.sectionId === cat);
  const selMeal = sel ? products.find((p) => p.id === sel) ?? null : null;

  // Restaurant branding from the public menu payload. `GREEN` shadows the module
  // default so every accent below uses the owner's chosen main color.
  const brandData = menuQuery.data as (PublicMenuResponse & { brandColor?: string; coverUrl?: string }) | undefined;
  const GREEN = brandData?.brandColor || BRAND_DEFAULT;
  const cover = brandData?.coverUrl;

  // ── states ──────────────────────────────────────────────────────────────────
  if (tableQuery.isLoading) {
    return <Centered><div style={{ width: 34, height: 34, border: `4px solid ${GREEN}33`, borderTopColor: GREEN, borderRadius: "50%", animation: "spin 1s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></Centered>;
  }
  if (tableQuery.isError || !tableQuery.data) {
    return (
      <Centered>
        <div style={{ width: 62, height: 62, borderRadius: "50%", background: "#f7e7e5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 30, color: "#b0463e" }}>!</span>
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>رمز الطاولة غير صالح</h1>
        <p style={{ fontSize: 13.5, color: "#727a6e", maxWidth: 260 }}>الرجاء مسح الرمز مرة أخرى أو التواصل مع طاقم المطعم.</p>
      </Centered>
    );
  }
  if (tableIsBusy) {
    return (
      <Centered>
        <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#fbf3e3", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 30, color: "#c98a1e" }}>⏳</span>
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 8px" }}>الطاولة مشغولة حالياً</h1>
        <p style={{ fontSize: 13.5, color: "#727a6e", maxWidth: 300, marginBottom: 18 }}>{submitError?.message}</p>
        <button onClick={() => submit.reset()} style={{ padding: "12px 22px", borderRadius: 12, border: "1px solid #e8ece4", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>المحاولة مرة أخرى</button>
      </Centered>
    );
  }

  const { table, restaurant } = tableQuery.data;
  const showLogo = restaurant.logoUrl && !logoFailed;
  const initial = (restaurant.name ?? "?").trim().charAt(0) || "?";

  // ── success / live tracker (polls real status; chime + banner on change) ───
  if (submittedOrder) {
    const status = liveStatus ?? "pending";
    const rejected = status === "voided";
    const stepIdx = STEP_OF[status] ?? 0;
    const steps = ["استُلم", "قيد التحضير", "اكتمل"];
    return (
      <Shell>
        {statusBanner && (
          <div style={{ position: "fixed", top: 14, insetInlineStart: "50%", transform: "translateX(50%)", zIndex: 50, width: "calc(100% - 32px)", maxWidth: 420, background: DARK, color: "#fff", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 14px 40px rgba(0,0,0,.28)" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>🔔</span>
            <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>تحديث على طلبك</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 1 }}>{statusBanner}</div></div>
          </div>
        )}
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "44px 22px 30px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 66, height: 66, borderRadius: "50%", background: rejected ? "#f7e7e5" : "#e7f2ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              {rejected
                ? <span style={{ fontSize: 30, color: "#b0463e", lineHeight: 0 }}>×</span>
                : <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M7 15.5l5 5L23 9" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <h2 style={{ fontSize: 23, fontWeight: 700, margin: "18px 0 6px" }}>{rejected ? "أُلغي الطلب" : status === "done" ? "اكتمل طلبك!" : "تم إرسال طلبك!"}</h2>
            <p style={{ fontSize: 13.5, color: "#727a6e", margin: "0 auto", maxWidth: 270, lineHeight: 1.5 }}>{rejected ? "نأسف، لم يتمكن المطعم من قبول الطلب. تواصل مع طاقم المطعم." : "طاقم المطبخ يحضّر طلبك. الدفع عند الكاشير."}</p>
            <div style={{ display: "flex", gap: 9, justifyContent: "center", marginTop: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: GREEN, background: "#e7f2ec", padding: "6px 12px", borderRadius: 9 }}>#{submittedOrder.orderNumber}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#5e665c", background: "#f1f3ee", padding: "6px 12px", borderRadius: 9 }}>طاولة {table.number}</span>
            </div>
          </div>
          {!rejected && (
            <div style={{ marginTop: 30, padding: "22px 16px", background: "#f7f8f5", borderRadius: 17, border: "1px solid #eef0ea" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                {steps.map((label, i) => {
                  const done = i < stepIdx || status === "done";
                  const active = i === stepIdx && status !== "done";
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>
                      {i > 0 && <div style={{ flex: 1, height: 2, marginTop: 14, background: i <= stepIdx ? GREEN : "#dfe4d9" }} />}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 62 }}>
                        <div style={{ width: 29, height: 29, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, background: done || active ? GREEN : "#e6e9e1", color: done || active ? "#fff" : "#9aa097", animation: active ? "sufpulse 2s infinite" : undefined }}>{done ? "✓" : i + 1}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, marginTop: 8, textAlign: "center", color: done || active ? DARK : "#9aa097" }}>{label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", marginTop: 18, fontSize: 12.5, color: GREEN, fontWeight: 600 }}>{status === "done" ? "شكراً! نتمنى لك وجبة شهية 🌿" : "الوقت المتوقع للتجهيز ~15 دقيقة"}</div>
            </div>
          )}
          <button onClick={() => { setSubmittedOrder(null); setTrackingDismissed(true); try { localStorage.removeItem(storageKey); } catch {} submit.reset(); prevStatusRef.current = null; setStatusBanner(null); setScreen("menu"); }} style={{ marginTop: 20, width: "100%", background: DARK, color: "#fff", border: "none", padding: 15, borderRadius: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>العودة للمنيو</button>
        </div>
      </Shell>
    );
  }

  // ── item detail ──────────────────────────────────────────────────────────
  if (screen === "item" && selMeal) {
    return (
      <Shell>
        <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", height: 296, background: "#eef0ed", flexShrink: 0 }}>
            <div style={stripe(tintFor(selMeal.id))} />
            <button onClick={() => setScreen("menu")} style={{ position: "absolute", top: 18, insetInlineStart: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.9)", cursor: "pointer", fontSize: 22, color: "#1b231d", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>›</button>
          </div>
          <div style={{ padding: "22px 20px 16px", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{selMeal.name}</h2>
              <span style={{ fontSize: 18, fontWeight: 700, color: GREEN, whiteSpace: "nowrap" }}>{formatPrice(Number(selMeal.basePrice))}</span>
            </div>
          </div>
          <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #eef0ea", padding: "14px 18px 28px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#f1f3ee", borderRadius: 12, padding: 4, flexShrink: 0 }}>
              <button onClick={() => setItemQty((q) => Math.max(1, q - 1))} style={qtyBtn}>−</button>
              <span style={{ minWidth: 34, textAlign: "center", fontSize: 16, fontWeight: 700 }}>{itemQty}</span>
              <button onClick={() => setItemQty((q) => q + 1)} style={qtyBtn}>+</button>
            </div>
            <button onClick={() => { addN(selMeal, itemQty); setScreen("menu"); }} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", padding: 15, borderRadius: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>أضف للطلب · {formatPrice(Number(selMeal.basePrice) * itemQty)}</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── cart ────────────────────────────────────────────────────────────────
  if (screen === "cart") {
    const lines = Object.values(cart);
    return (
      <Shell>
        <div style={{ minHeight: "100dvh", background: "#f7f8f5", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", padding: "16px 18px 15px", borderBottom: "1px solid #eef0ea", display: "flex", alignItems: "center", gap: 13 }}>
            <button onClick={() => setScreen("menu")} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid #e8ece4", background: "#fff", cursor: "pointer", fontSize: 22, color: "#1b231d", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }}>›</button>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>طلبك</div><div style={{ fontSize: 12, color: "#8a917f", marginTop: 1 }}>طاولة {table.number}</div></div>
          </div>
          {activeOrder && activeOrder.items.length > 0 && (
            <div style={{ margin: "14px 16px 0", padding: "13px 15px", background: "#fff", border: "1px solid #ebeee8", borderRadius: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>أصناف مُرسلة للمطبخ</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, background: "#e7f2ec", padding: "3px 8px", borderRadius: 7 }}>#{activeOrder.orderNumber}</span>
              </div>
              {activeOrder.items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5e665c", padding: "4px 0" }}>
                  <span>{it.name} <span style={{ color: "#9aa097" }}>×{it.quantity}</span></span>
                  <span style={{ fontWeight: 600, fontFamily: MONO }}>{formatPrice(Number(it.totalPrice))}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#9aa097", marginTop: 8 }}>لا يمكن حذف الأصناف المُرسلة — يمكنك إضافة المزيد فقط.</div>
            </div>
          )}
          {lines.length > 0 ? (
            <>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
                {lines.map(({ meal, qty }) => (
                  <div key={meal.id} style={{ display: "flex", gap: 13, alignItems: "center", padding: 13, background: "#fff", border: "1px solid #ebeee8", borderRadius: 15 }}>
                    <div style={{ position: "relative", width: 56, height: 56, borderRadius: 11, overflow: "hidden", flexShrink: 0, background: "#eef0ed" }}><div style={stripe(tintFor(meal.id))} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{meal.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 5 }}>{formatPrice(Number(meal.basePrice) * qty)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#f1f3ee", borderRadius: 10, padding: 3, flexShrink: 0 }}>
                      <button onClick={() => remove(meal.id)} style={miniBtn}>−</button>
                      <span style={{ minWidth: 24, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{qty}</span>
                      <button onClick={() => add(meal)} style={miniBtn}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #eef0ea", padding: "16px 20px 28px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسمك (اختياري)" style={inputStyle} />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="رقم الجوال (اختياري)" dir="ltr" style={inputStyle} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, color: "#727a6e" }}>الإجمالي</span><span style={{ fontSize: 20, fontWeight: 700 }}>{formatPrice(subtotal)}</span></div>
                <button onClick={() => submit.mutate()} disabled={submit.isPending} style={{ width: "100%", background: GREEN, color: "#fff", border: "none", padding: 16, borderRadius: 14, fontSize: 15.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: submit.isPending ? 0.6 : 1, boxShadow: "0 8px 22px rgba(31,138,91,.3)" }}>
                  {submit.isPending ? "جارٍ الإرسال…" : `${activeOrder ? "أضف إلى طلبك" : "أرسل الطلب للمطبخ"} · ${totalItems} عنصر`}
                </button>
                {submitError && !tableIsBusy && <p style={{ fontSize: 12, color: "#b0463e", textAlign: "center", marginTop: 10 }}>{submitError.message}</p>}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>سلتك فارغة</div>
              <button onClick={() => setScreen("menu")} style={{ marginTop: 18, background: "#e7f2ec", color: GREEN, border: "none", padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>تصفّح المنيو</button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ── menu (default) ─────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ minHeight: "100dvh", background: "#f7f8f5", paddingBottom: 120 }}>
        {cover && (
          <div style={{ height: 128, position: "relative", background: "#eef0ed" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #f7f8f5, rgba(247,248,245,0) 64%)" }} />
          </div>
        )}
        <div style={{ position: "sticky", top: 0, zIndex: 6, background: "rgba(247,248,245,.93)", backdropFilter: "blur(12px)", padding: "18px 18px 0", borderBottom: "1px solid #e8ece4" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "#e7f2ec", display: "flex", alignItems: "center", justifyContent: "center", color: GREEN, fontWeight: 700, fontSize: 18 }}>
                {showLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.logoUrl!} alt={restaurant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setLogoFailed(true)} />
                ) : initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{restaurant.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a917f", marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
                  طاولة {table.number}{table.section ? ` · ${table.section}` : ""}
                </div>
              </div>
            </div>
          </div>
          {sections.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 0 13px" }}>
              {[{ id: "all", name: "الكل" }, ...sections.map((s) => ({ id: s.id, name: s.name }))].map((c) => {
                const on = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)} style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, background: on ? DARK : "#fff", color: on ? "#fff" : "#5e665c", boxShadow: on ? "none" : "inset 0 0 0 1px #e8ece4", whiteSpace: "nowrap" }}>{c.name}</button>
                );
              })}
            </div>
          )}
        </div>

        {activeOrder && (
          <div style={{ margin: "14px 16px 0", padding: "13px 15px", background: "#e7f2ec", border: `1px solid ${GREEN}33`, borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17 }}>🍽️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK }}>لديك طلب مفتوح على هذه الطاولة</div>
              <div style={{ fontSize: 12, color: "#5e665c", marginTop: 1 }}>
                {STATUS_LABEL[activeOrder.status] ?? activeOrder.status} · {activeOrder.items.reduce((s, i) => s + i.quantity, 0)} صنف · يمكنك إضافة المزيد
              </div>
            </div>
            <button
              onClick={() => { setTrackingDismissed(false); setSubmittedOrder({ id: activeOrder.id, orderNumber: activeOrder.orderNumber }); }}
              style={{ flexShrink: 0, background: GREEN, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              تتبّع الطلب
            </button>
          </div>
        )}
        {menuQuery.isLoading ? (
          <p style={{ textAlign: "center", padding: 40, color: "#8a917f", fontSize: 14 }}>جارٍ تحميل المنيو…</p>
        ) : products.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "#8a917f", fontSize: 14 }}>القائمة غير متاحة حالياً</p>
        ) : (
          <div style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.map((p) => {
              const available = p.isAvailable !== false;
              return (
                <div key={p.id} onClick={() => available && (setSel(p.id), setItemQty(1), setScreen("item"))} style={{ display: "flex", gap: 14, padding: 13, background: "#fff", border: "1px solid #ebeee8", borderRadius: 17, cursor: available ? "pointer" : "default", alignItems: "center", opacity: available ? 1 : 0.65 }}>
                  <div style={{ position: "relative", width: 84, height: 84, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "#eef0ed" }}><div style={stripe(tintFor(p.id))} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: "#1b231d" }}>{p.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: GREEN }}>{formatPrice(Number(p.basePrice))}</span>
                      {available ? (
                        <button onClick={(e) => { e.stopPropagation(); add(p); }} style={{ width: 31, height: 31, borderRadius: 9, border: "none", background: "#e7f2ec", color: GREEN, fontSize: 20, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0, flexShrink: 0 }}>+</button>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#b0463e", background: "#f7e7e5", padding: "5px 10px", borderRadius: 8 }}>نفد</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <div style={{ position: "fixed", insetInlineStart: "50%", transform: "translateX(50%)", bottom: 0, width: "100%", maxWidth: 460, padding: "14px 16px 26px", background: "linear-gradient(to top,#f7f8f5 62%,rgba(247,248,245,0))", pointerEvents: "none" }}>
          <button onClick={() => setScreen("cart")} style={{ pointerEvents: "auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 18px", borderRadius: 16, background: GREEN, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 26px rgba(31,138,91,.32)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
              <span style={{ background: "rgba(255,255,255,.22)", minWidth: 24, height: 24, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, padding: "0 6px" }}>{totalItems}</span>
              عرض الطلب
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}
    </Shell>
  );
}

const qtyBtn: CSSProperties = { width: 38, height: 38, border: "none", background: "#fff", borderRadius: 9, fontSize: 21, color: "#1b231d", cursor: "pointer", lineHeight: 0, boxShadow: "0 1px 2px rgba(0,0,0,.06)" };
const miniBtn: CSSProperties = { width: 30, height: 30, border: "none", background: "#fff", borderRadius: 8, fontSize: 18, color: "#1b231d", cursor: "pointer", lineHeight: 0 };
const inputStyle: CSSProperties = { padding: "11px 12px", border: "1px solid #e4e8e0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#f7f8f5", outline: "none", color: DARK, width: "100%", boxSizing: "border-box" };
