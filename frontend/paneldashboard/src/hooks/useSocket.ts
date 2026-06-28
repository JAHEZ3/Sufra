"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import {
  socketService,
  readPanelAccessToken,
  type SocketError,
  type SocketEventName,
  type SocketStatus,
} from "@/lib/socket.service";

/**
 * Bootstraps the singleton socket once per app load. Call this from the
 * panel's root layout (e.g. `(panel)/layout.tsx`) so every screen shares
 * the same connection.
 */
export function useSocketBootstrap() {
  useEffect(() => {
    const token = readPanelAccessToken();
    if (token) socketService.connect(token);
    // Don't disconnect on unmount — the singleton survives navigation.
  }, []);
}

/**
 * Subscribe to a single socket event. Handler is held in a ref so the parent
 * can pass an inline arrow without re-binding on every render. Dedup at the
 * service layer means the same handler reference is never registered twice.
 */
export function useSocketEvent<T = unknown>(
  event: SocketEventName,
  handler: (payload: T) => void,
  enabled: boolean = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    return socketService.on(event, (payload) => {
      handlerRef.current(payload as T);
    });
  }, [event, enabled]);
}

/** Join an order room for the lifetime of the component. */
export function useJoinOrderRoom(
  orderId: string | undefined | null,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled || !orderId) return;
    socketService.joinOrder(orderId);
    return () => {
      socketService.leaveOrder(orderId);
    };
  }, [orderId, enabled]);
}

/** Connection status (idle / connecting / open / closed). */
export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(() =>
    socketService.getStatus(),
  );
  useEffect(() => socketService.onStatus(setStatus), []);
  return status;
}

/** Surface gateway errors (AUTH_FAILED / ACCOUNT_INACTIVE / GAVE_UP …). */
export function useSocketError(): {
  error: SocketError | null;
  clear: () => void;
  retry: () => void;
} {
  const [error, setError] = useState<SocketError | null>(null);
  useEffect(() => socketService.onError(setError), []);
  return {
    error,
    clear: () => {
      socketService.clearError();
      setError(null);
    },
    retry: () => {
      socketService.clearError();
      setError(null);
      socketService.reconnect();
    },
  };
}

/**
 * Cache-coherent realtime: when an order's status changes OR a brand-new
 * order arrives, invalidate the orders list and (if applicable) the specific
 * order's detail so any open table/dialog reflects the change instantly.
 *
 * Mount this once at a high level (e.g. the panel layout) — the underlying
 * subscription is deduplicated by reference.
 */
export function useOrdersRealtime() {
  const qc = useQueryClient();

  // Use the bare `["orders"]` prefix instead of `queryKeys.orders.all()` so
  // every variant (list-with-filters AND order-detail) gets invalidated in a
  // single call. TanStack's queryKey matching is prefix-based.
  const invalidateAll = () =>
    qc.invalidateQueries({ queryKey: queryKeys.orders.root ?? ["orders"] });

  useSocketEvent("order:status:updated", (payload: unknown) => {
    const p = payload as { orderId?: string } | undefined;
    invalidateAll();
    if (p?.orderId)
      qc.invalidateQueries({ queryKey: queryKeys.orders.one(p.orderId) });
  });

  useSocketEvent("order:new", invalidateAll);
  useSocketEvent("order:delivery:assigned", (payload: unknown) => {
    const p = payload as { orderId?: string } | undefined;
    invalidateAll();
    if (p?.orderId)
      qc.invalidateQueries({ queryKey: queryKeys.orders.one(p.orderId) });
  });
  // Payment status flip (unpaid ↔ paid) — keeps the badge in the orders
  // table + the OrderDetailsDialog in sync without a manual reload.
  useSocketEvent("order:payment:status", (payload: unknown) => {
    const p = payload as { orderId?: string } | undefined;
    invalidateAll();
    if (p?.orderId)
      qc.invalidateQueries({ queryKey: queryKeys.orders.one(p.orderId) });
  });
}

/**
 * Chat subscription for one order. Returns the list of messages received
 * since mount; the caller merges them with the HTTP-loaded history. The
 * underlying `chat:new` socket event is filtered to the requested orderId
 * so two open dialogs don't cross-pollinate.
 */
export interface ChatMessageEvent {
  id?: string;
  messageId?: string;
  orderId: string;
  senderId: string;
  senderRole: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

export function useOrderChat(orderId: string | undefined | null) {
  useJoinOrderRoom(orderId);
  const [messages, setMessages] = useState<ChatMessageEvent[]>([]);

  useSocketEvent<ChatMessageEvent>(
    "chat:new",
    (msg) => {
      if (!orderId || msg.orderId !== orderId) return;
      const id = msg.id ?? msg.messageId;
      if (!id) return;
      setMessages((prev) => {
        const exists = prev.some((m) => (m.id ?? m.messageId) === id);
        return exists ? prev : [...prev, msg];
      });
    },
    !!orderId,
  );

  return {
    messages,
    reset: () => setMessages([]),
    send: (content: string) => {
      if (!orderId) return;
      // Server-side persistence still goes through HTTP — see chat controller.
      // The socket only broadcasts the post-persistence message.
      // For optimistic UX the caller can append locally first.
      void content;
    },
  };
}
