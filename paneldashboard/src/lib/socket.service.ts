"use client";

import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";
import { ACCESS_TOKEN_COOKIE } from "@/lib/api";

/**
 * Paneldashboard socket service — a single Socket.IO client shared across the
 * entire panel. Mirrors the mobile `socket.service.ts` shape so anyone who
 * knows one can read the other.
 *
 * Responsibilities:
 *  - One physical socket per token (rebuilt on token rotation).
 *  - Auto-rejoin of every `order:join` room after a reconnect.
 *  - Typed `error` channel that surfaces both gateway-emitted `error` events
 *    (AUTH_FAILED / ACCOUNT_INACTIVE) and raw `connect_error` timeouts.
 *  - Bounded reconnect attempts (10) so a misconfigured `NEXT_PUBLIC_GATEWAY_URL`
 *    doesn't loop forever in the browser.
 *  - Manual `reconnect()` so the UI's retry button can rebuild after GAVE_UP.
 */

export type SocketStatus = "idle" | "connecting" | "open" | "closed";

export interface SocketError {
  code:
    | "AUTH_FAILED"
    | "ACCOUNT_INACTIVE"
    | "CONNECT_ERROR"
    | "GAVE_UP"
    | "UNKNOWN";
  message: string;
}

export type SocketEventName =
  | "connected"
  | "error"
  | "order:status:updated"
  | "order:status"
  | "order:delivery:assigned"
  | "order:new"
  | "delivery:location"
  | "chat:new"
  | "chat:message"
  | "chat:typing"
  | "restaurant:registered"
  | (string & {});

type Handler = (payload: unknown) => void;
type StatusHandler = (status: SocketStatus) => void;
type ErrorHandler = (err: SocketError) => void;

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

// Server emits canonical → native names. Mobile already maps these; the panel
// uses the same map so a handler registered on either spelling fires once.
const EVENT_ALIASES: Record<string, string[]> = {
  "order:status": ["order:status:updated"],
  "chat:message": ["chat:new"],
};

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private status: SocketStatus = "idle";

  private listeners = new Map<string, Set<Handler>>();
  private statusListeners = new Set<StatusHandler>();
  private errorListeners = new Set<ErrorHandler>();
  private lastError: SocketError | null = null;

  /** Rooms the app wants to be in. Rejoined automatically after reconnect. */
  private desiredOrderRooms = new Set<string>();
  /** restaurant:register payload — resent after reconnect. */
  private restaurantId: string | null = null;

  private nativeEventsBound = new Set<string>();
  private consecutiveFailures = 0;
  private warned = false;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Connect (or reconnect with a fresh token). Idempotent. */
  connect(token: string) {
    if (!GATEWAY_URL) {
      if (!this.warned && typeof window !== "undefined") {
        this.warned = true;
        console.warn(
          "[socket] NEXT_PUBLIC_GATEWAY_URL is not set — realtime features disabled.",
        );
      }
      return;
    }
    if (!token) return;
    if (this.token === token && this.socket?.connected) return;

    // Token rotation: rebuild so the gateway re-authenticates with the new token.
    if (this.socket && this.token !== token) {
      this.teardown();
    }
    this.token = token;

    if (this.socket) {
      this.socket.connect();
      return;
    }

    this.setStatus("connecting");
    this.socket = io(GATEWAY_URL, {
      // Polling-first so a brief WS-only blip (gateway reload) doesn't spam
      // "WebSocket connection failed". Socket.IO upgrades to WS once the
      // session is open.
      transports: ["polling", "websocket"],
      auth: { token: `Bearer ${token}` },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.3,
      timeout: 10_000,
    });

    this.bindLifecycleEvents(this.socket);
    // Re-bind listeners callers registered before connect.
    for (const event of this.listeners.keys()) this.bindNativeEvent(event);
  }

  disconnect() {
    this.teardown();
    this.setStatus("closed");
  }

  /** Manual reconnect after GAVE_UP — used by the UI retry button. */
  reconnect() {
    if (!this.token) return;
    const token = this.token;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.teardown();
    this.token = null;
    this.connect(token);
  }

  private teardown() {
    if (!this.socket) return;
    try {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    } catch {
      /* ignore */
    }
    this.socket = null;
    this.token = null;
    this.nativeEventsBound.clear();
  }

  // ─── Listener API ─────────────────────────────────────────────────────────

  on(event: SocketEventName, handler: Handler): () => void {
    const set = this.listeners.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.listeners.set(event, set);
    this.bindNativeEvent(event);
    return () => this.off(event, handler);
  }

  off(event: SocketEventName, handler: Handler) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.listeners.delete(event);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.status);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorListeners.add(handler);
    if (this.lastError) handler(this.lastError);
    return () => {
      this.errorListeners.delete(handler);
    };
  }

  clearError() {
    this.lastError = null;
  }

  emit(event: string, data?: unknown) {
    if (!this.socket || !this.socket.connected) {
      console.log("[socket] emit dropped — not connected", { event });
      return;
    }
    this.socket.emit(event, data);
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  // ─── Room management ──────────────────────────────────────────────────────

  joinOrder(orderId: string) {
    if (this.desiredOrderRooms.has(orderId)) return;
    this.desiredOrderRooms.add(orderId);
    if (this.socket?.connected) this.socket.emit("order:join", { orderId });
  }

  leaveOrder(orderId: string) {
    if (!this.desiredOrderRooms.has(orderId)) return;
    this.desiredOrderRooms.delete(orderId);
    if (this.socket?.connected) this.socket.emit("order:leave", { orderId });
  }

  registerRestaurant(restaurantId: string) {
    this.restaurantId = restaurantId;
    if (this.socket?.connected) {
      this.socket.emit("restaurant:register", { restaurantId });
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private bindLifecycleEvents(socket: Socket) {
    socket.on("connect", () => {
      console.log("[socket] connected", { id: socket.id });
      this.setStatus("open");
      this.lastError = null;
      this.consecutiveFailures = 0;
      this.rejoinRooms();
    });

    socket.on("disconnect", (reason: string) => {
      console.log("[socket] disconnected", { reason });
      this.setStatus("closed");
    });

    socket.on("connect_error", (err: Error) => {
      this.consecutiveFailures += 1;
      // Log first failure + every 5th retry, but DO NOT dispatch to error
      // subscribers while the socket is still retrying. The HTTP API is
      // unaffected — the panel keeps working, just without live updates,
      // and the UI doesn't get a banner that will resolve itself in seconds.
      // Terminal `reconnect_failed` still fires GAVE_UP for the retry button.
      if (
        this.consecutiveFailures === 1 ||
        this.consecutiveFailures % 5 === 0
      ) {
        console.log("[socket] connect_error (retrying silently)", {
          message: err.message,
          attempt: this.consecutiveFailures,
        });
      }
    });

    // Gateway-emitted error (AUTH_FAILED / ACCOUNT_INACTIVE) — the gateway
    // calls `disconnect(true)` immediately after, so this is the only chance
    // to surface the reason.
    socket.on("error", (payload: unknown) => {
      const err = this.coerceError(payload);
      console.log("[socket] gateway error", err);
      this.dispatchError(err);
    });

    socket.io.on("reconnect_attempt", (attempt: number) => {
      if (attempt === 1 || attempt % 5 === 0) {
        console.log("[socket] reconnect_attempt", { attempt });
      }
      this.setStatus("connecting");
    });

    socket.io.on("reconnect", (attempt: number) => {
      console.log("[socket] reconnected", { attempt });
      this.setStatus("open");
    });

    socket.io.on("reconnect_failed", () => {
      console.log("[socket] reconnect_failed — giving up");
      this.setStatus("closed");
      this.dispatchError({
        code: "GAVE_UP",
        message:
          "تعذر الاتصال بخدمة التتبع. تحقّق من الاتصال ثم اضغط إعادة المحاولة.",
      });
    });
  }

  private bindNativeEvent(canonicalEvent: string) {
    if (!this.socket) return;
    const nativeEvent =
      Object.entries(EVENT_ALIASES).find(([, aliases]) =>
        aliases.includes(canonicalEvent),
      )?.[0] ?? canonicalEvent;

    if (this.nativeEventsBound.has(nativeEvent)) return;
    this.nativeEventsBound.add(nativeEvent);

    this.socket.on(nativeEvent, (payload: unknown) => {
      this.dispatch(nativeEvent, payload);
      const aliases = EVENT_ALIASES[nativeEvent] ?? [];
      for (const alias of aliases) this.dispatch(alias, payload);
    });
  }

  private dispatch(event: string, payload: unknown) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    set.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.log(`[socket] handler for "${event}" threw`, err);
      }
    });
  }

  private rejoinRooms() {
    if (!this.socket?.connected) return;
    if (this.restaurantId) {
      this.socket.emit("restaurant:register", { restaurantId: this.restaurantId });
    }
    for (const orderId of this.desiredOrderRooms) {
      this.socket.emit("order:join", { orderId });
    }
  }

  private setStatus(status: SocketStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((handler) => {
      try {
        handler(status);
      } catch {
        /* ignore */
      }
    });
  }

  private coerceError(payload: unknown): SocketError {
    if (payload && typeof payload === "object") {
      const p = payload as { code?: unknown; message?: unknown };
      const code =
        typeof p.code === "string"
          ? (p.code as SocketError["code"])
          : "UNKNOWN";
      const message =
        typeof p.message === "string" && p.message
          ? p.message
          : "تعذر الاتصال بخدمة التتبع";
      return { code, message };
    }
    return { code: "UNKNOWN", message: "تعذر الاتصال بخدمة التتبع" };
  }

  private dispatchError(err: SocketError) {
    this.lastError = err;
    this.errorListeners.forEach((handler) => {
      try {
        handler(err);
      } catch {
        /* ignore */
      }
    });
  }
}

export const socketService = new SocketService();

/** Read the panel access token from cookies — same key as the axios client. */
export function readPanelAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get(ACCESS_TOKEN_COOKIE) ?? null;
}
