"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";

// Resolve once. If unset we skip the socket entirely instead of silently
// pointing it at the Next.js dev server (which doesn't host /socket.io/).
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

let sharedSocket: Socket | null = null;
let warned = false;

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(
    () => sharedSocket?.connected ?? false,
  );

  useEffect(() => {
    if (!accessToken) return;
    if (!GATEWAY_URL) {
      if (!warned && typeof window !== "undefined") {
        warned = true;
        console.warn(
          "[useSocket] NEXT_PUBLIC_GATEWAY_URL is not set — realtime features are disabled.",
        );
      }
      return;
    }

    if (!sharedSocket) {
      sharedSocket = io(GATEWAY_URL, {
        auth: { token: `Bearer ${accessToken}` },
        // Polling-first so a WebSocket-only blip (gateway restart, nest --watch
        // recompile) doesn't spam the console with `WebSocket connection failed`.
        // Socket.IO auto-upgrades to WebSocket once the session is open.
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10_000,
        // Cap retries — matches mobile + paneldashboard. After 10 failed
        // attempts socket.io stops, so a wrong GATEWAY_URL doesn't hammer the
        // browser forever. A page reload kicks off a fresh connection.
        reconnectionAttempts: 10,
      });
    } else {
      // Refresh auth on token rotation so reconnect uses the latest access token.
      sharedSocket.auth = { token: `Bearer ${accessToken}` };
      if (!sharedSocket.connected) sharedSocket.connect();
    }

    socketRef.current = sharedSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    sharedSocket.on("connect", onConnect);
    sharedSocket.on("disconnect", onDisconnect);
    if (sharedSocket.connected) setConnected(true);

    return () => {
      // Keep the shared connection alive across unmounts; just detach our state
      // listeners so they don't leak into a stale closure.
      sharedSocket?.off("connect", onConnect);
      sharedSocket?.off("disconnect", onDisconnect);
    };
  }, [accessToken]);

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      const sock = socketRef.current ?? sharedSocket;
      sock?.on(event, handler);
      return () => sock?.off(event, handler);
    },
    [],
  );

  const emit = useCallback((event: string, data?: unknown) => {
    (socketRef.current ?? sharedSocket)?.emit(event, data);
  }, []);

  const joinOrder = useCallback((orderId: string) => {
    (socketRef.current ?? sharedSocket)?.emit("order:join", { orderId });
  }, []);

  const leaveOrder = useCallback((orderId: string) => {
    (socketRef.current ?? sharedSocket)?.emit("order:leave", { orderId });
  }, []);

  const registerRestaurant = useCallback((restaurantId: string) => {
    (socketRef.current ?? sharedSocket)?.emit("restaurant:register", { restaurantId });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    on,
    emit,
    joinOrder,
    leaveOrder,
    registerRestaurant,
  };
}

/**
 * Cache-coherent realtime for the orders page. Listens for the gateway's
 * payment-status / order-status / order-new events and invalidates the
 * orders queries so any open list or detail dialog reflects changes made
 * elsewhere (paneldashboard manager, another staff session, NATS event).
 *
 * Mount once at the orders page top — it's safe to mount even when the
 * socket isn't yet connected; the underlying listeners no-op on null.
 */
export function useOrdersRealtime() {
  const { on } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    };
    const offStatus = on("order:status", invalidate);
    const offNew = on("order:new", invalidate);
    const offPayment = on("order:payment:status", invalidate);
    const offAssigned = on("order:delivery:assigned", invalidate);
    return () => {
      offStatus?.();
      offNew?.();
      offPayment?.();
      offAssigned?.();
    };
  }, [on, queryClient]);
}
