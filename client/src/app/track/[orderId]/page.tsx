"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { Loader2, MapPin, Phone, Bike, ShieldCheck, AlertCircle } from "lucide-react";
import { MapboxMap, type MapPin as MapPinData } from "@/components/ui/mapbox-map";
import { apiClient, restaurantClient } from "@/lib/axios";

interface DeliveryAddressSnapshot {
  street?: string;
  city?: string;
  lat?: number;
  lng?: number;
  label?: string;
}

interface OrderTrackingPayload {
  id: string;
  orderNumber: string;
  status: string;
  restaurantId: string;
  customerName?: string;
  deliveryAddressSnapshot?: DeliveryAddressSnapshot | null;
  estimatedDeliveryAt?: string | null;
  deliveryAgent?: { id: string; name: string; phone?: string } | null;
}

interface RestaurantInfo {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  logoUrl?: string | null;
}

interface LiveDriverLocation {
  agentId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "تم تأكيد الطلب",
  preparing: "يتم تحضير طلبك",
  ready_for_pickup: "جاهز للاستلام من المطعم",
  out_for_delivery: "السائق في الطريق إليك",
  delivered: "تم التوصيل",
  cancelled: "تم إلغاء الطلب",
};

function unwrap<T>(payload: unknown): T {
  const root = payload as { data?: T } | T;
  if (root && typeof root === "object" && "data" in root) {
    return (root as { data?: T }).data as T;
  }
  return root as T;
}

export default function TrackOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [driverLoc, setDriverLoc] = useState<LiveDriverLocation | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // ─── Order details ─────────────────────────────────────────────────────────
  const orderQuery = useQuery<OrderTrackingPayload>({
    queryKey: ["track-order", orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/order/orders/${orderId}`);
      return unwrap<OrderTrackingPayload>(res.data);
    },
    retry: 1,
  });

  // ─── Restaurant info (for the pickup pin) ──────────────────────────────────
  const restaurantId = orderQuery.data?.restaurantId;
  const restaurantQuery = useQuery<RestaurantInfo>({
    queryKey: ["track-restaurant", restaurantId],
    queryFn: async () => {
      const res = await restaurantClient.get(`/api/restaurant/${restaurantId}`);
      const body = unwrap<{ restaurant?: RestaurantInfo } | RestaurantInfo>(res.data);
      return "restaurant" in (body as object)
        ? ((body as { restaurant: RestaurantInfo }).restaurant)
        : (body as RestaurantInfo);
    },
    enabled: !!restaurantId,
    retry: 1,
  });

  // ─── Live socket subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !orderId) return;
    const token = localStorage.getItem("sufra_token");
    if (!token) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    const socket: Socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("order:join", { orderId });
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("delivery:location", (payload: LiveDriverLocation) => {
      setDriverLoc(payload);
    });

    return () => {
      socket.emit("order:leave", { orderId });
      socket.disconnect();
    };
  }, [orderId]);

  // ─── Pins ──────────────────────────────────────────────────────────────────
  const pins = useMemo<MapPinData[]>(() => {
    const out: MapPinData[] = [];
    const r = restaurantQuery.data;
    if (r && typeof r.lat === "number" && typeof r.lng === "number") {
      out.push({
        id: "restaurant",
        lat: r.lat,
        lng: r.lng,
        label: r.name,
        color: "#2563EB",
        popupHtml: `<div style="font-family:inherit;font-size:13px;"><strong>المطعم</strong><br/>${escapeHtml(r.name)}</div>`,
      });
    }
    const drop = orderQuery.data?.deliveryAddressSnapshot;
    if (drop && typeof drop.lat === "number" && typeof drop.lng === "number") {
      out.push({
        id: "dropoff",
        lat: drop.lat,
        lng: drop.lng,
        label: "موقع التسليم",
        color: "#16A34A",
        popupHtml: `<div style="font-family:inherit;font-size:13px;"><strong>موقع التسليم</strong><br/><span style="color:#666">${escapeHtml(
          [drop.label, drop.street, drop.city].filter(Boolean).join("، ") || "",
        )}</span></div>`,
      });
    }
    if (driverLoc) {
      out.push({
        id: "driver",
        lat: driverLoc.lat,
        lng: driverLoc.lng,
        label: "السائق",
        color: "#1f8a5b",
        popupHtml: `<div style="font-family:inherit;font-size:13px;"><strong>السائق</strong><br/><span style="color:#666">آخر تحديث الآن</span></div>`,
      });
    }
    return out;
  }, [restaurantQuery.data, orderQuery.data, driverLoc]);

  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-muted/30">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h1 className="text-lg font-bold mb-1">تعذّر تحميل الطلب</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          تأكّد من تسجيل الدخول وأن رقم الطلب صحيح، ثم أعِد المحاولة.
        </p>
      </div>
    );
  }

  const order = orderQuery.data;
  const statusText = STATUS_LABEL[order.status] ?? order.status;
  const drop = order.deliveryAddressSnapshot;
  const dropoffAddress = drop
    ? [drop.label, drop.street, drop.city].filter(Boolean).join("، ")
    : "";

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">طلب رقم</p>
            <p className="font-mono font-black text-base">{order.orderNumber}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className={socketConnected ? "text-green-600" : "text-gray-500"}>
              {socketConnected ? "اتصال مباشر نشط" : "اتصال غير متاح"}
            </span>
          </div>
        </div>
      </div>

      {/* Hero banner */}
      <div className="px-4 py-5">
        <div className="max-w-3xl mx-auto">
          <div
            className="rounded-2xl p-5 text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg,#1f8a5b 0%,#2fa06d 100%)",
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 w-fit mb-3">
              <Bike className="w-3.5 h-3.5" />
              تتبع مباشر
            </div>
            <h1 className="text-xl md:text-2xl font-black mb-1.5">
              تابع توصيل طلبك على الخريطة في الوقت الفعلي
            </h1>
            <p className="text-white/90 text-sm">{statusText}</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="px-4">
        <div className="max-w-3xl mx-auto">
          <div className="h-[460px] md:h-[520px] w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            <MapboxMap pins={pins} animate zoom={14} />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="px-4 mt-5">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard
            icon={<MapPin className="w-4 h-4 text-green-600" />}
            title="موقع التسليم"
            body={dropoffAddress || "—"}
          />
          {order.deliveryAgent ? (
            <InfoCard
              icon={<Bike className="w-4 h-4 text-[#1f8a5b]" />}
              title={`السائق: ${order.deliveryAgent.name}`}
              body={
                order.deliveryAgent.phone ? (
                  <a
                    href={`tel:${order.deliveryAgent.phone}`}
                    dir="ltr"
                    className="text-[#1f8a5b] font-semibold inline-flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {order.deliveryAgent.phone}
                  </a>
                ) : (
                  "في الطريق إليك"
                )
              }
            />
          ) : (
            <InfoCard
              icon={<ShieldCheck className="w-4 h-4 text-blue-600" />}
              title="السائق"
              body="سيتم تعيين سائق فور خروج الطلب من المطعم."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="text-sm text-gray-600">{body}</div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
