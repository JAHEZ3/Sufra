"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Bike,
  Users,
  Map as MapIcon,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapboxMap, type MapPin } from "@/components/ui/mapbox-map";
import { mapApi, type UserMapResponse } from "@/lib/api";

type LayerKey = "restaurants" | "customers" | "drivers";

const LAYER_CONFIG: Record<
  LayerKey,
  { label: string; color: string; icon: React.ReactNode }
> = {
  restaurants: {
    label: "المطاعم",
    color: "#2563EB",
    icon: <Building2 className="w-4 h-4" />,
  },
  customers: {
    label: "العملاء",
    color: "#16A34A",
    icon: <Users className="w-4 h-4" />,
  },
  drivers: {
    label: "السائقون",
    color: "#1f8a5b",
    icon: <Bike className="w-4 h-4" />,
  },
};

export default function PanelMapPage() {
  const [active, setActive] = useState<Record<LayerKey, boolean>>({
    restaurants: true,
    customers: true,
    drivers: true,
  });

  const { data, isLoading, isFetching, refetch } = useQuery<UserMapResponse>({
    queryKey: ["map", "users"],
    queryFn: async () => {
      const res = await mapApi.users();
      // Manager-service has no global response interceptor, so the controller
      // sometimes returns the body directly and sometimes wrapped in { data }.
      // Tolerate both, and fall back to empty layers so React Query never
      // sees an `undefined` result (which would throw at runtime).
      const body = res.data as UserMapResponse | { data?: UserMapResponse };
      const inner =
        body && typeof body === "object" && "data" in body && body.data
          ? (body.data as UserMapResponse)
          : (body as UserMapResponse);
      return {
        restaurants: inner?.restaurants ?? [],
        customers: inner?.customers ?? [],
        drivers: inner?.drivers ?? [],
      };
    },
    refetchInterval: 60_000,
  });

  const pins = useMemo<MapPin[]>(() => {
    if (!data) return [];
    const out: MapPin[] = [];
    if (active.restaurants) {
      data.restaurants.forEach((r) => {
        out.push({
          id: `restaurant:${r.id}`,
          lat: r.lat,
          lng: r.lng,
          label: r.name,
          color: LAYER_CONFIG.restaurants.color,
          popupHtml: `<div style="font-family:inherit;font-size:13px;">
            <strong>${escapeHtml(r.name)}</strong>
            <br/><span style="color:#666">${escapeHtml(r.city ?? "")}</span>
            <br/><span style="color:#999">مطعم</span>
          </div>`,
        });
      });
    }
    if (active.customers) {
      data.customers.forEach((c) => {
        out.push({
          id: `customer:${c.id}`,
          lat: c.lat,
          lng: c.lng,
          label: c.name,
          color: LAYER_CONFIG.customers.color,
          popupHtml: `<div style="font-family:inherit;font-size:13px;">
            <strong>${escapeHtml(c.name)}</strong>
            <br/><span style="color:#999">عميل</span>
          </div>`,
        });
      });
    }
    if (active.drivers) {
      data.drivers.forEach((d) => {
        out.push({
          id: `driver:${d.id}`,
          lat: d.lat,
          lng: d.lng,
          label: d.name,
          color: LAYER_CONFIG.drivers.color,
          popupHtml: `<div style="font-family:inherit;font-size:13px;">
            <strong>${escapeHtml(d.name)}</strong>
            <br/><span style="color:#999">سائق توصيل</span>
            <br/><span style="color:#666;font-size:11px">آخر تحديث: ${new Date(d.recordedAt).toLocaleTimeString("ar")}</span>
          </div>`,
        });
      });
    }
    return out;
  }, [data, active]);

  function toggle(key: LayerKey) {
    setActive((a) => ({ ...a, [key]: !a[key] }));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="خريطة المنصة"
        subtitle="رؤية شاملة لمواقع المطاعم والعملاء والسائقين"
      />

      <div className="p-6 space-y-6 animate-fade-in-up">
        {/* Hero */}
        <Card
          className="relative overflow-hidden border-0 text-white"
          style={{ background: "linear-gradient(135deg,#1f8a5b 0%,#2fa06d 60%,#5cc295 100%)" }}
        >
          <div className="relative p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold mb-2">
                <MapIcon className="w-3.5 h-3.5" />
                خريطة حية
              </div>
              <h2 className="text-xl md:text-2xl font-black mb-1">
                مواقع كل الأطراف على المنصة
              </h2>
              <p className="text-white/85 text-sm">
                نقاط المطاعم والعملاء ثابتة. مواقع السائقين تتحدث تلقائياً كل دقيقة.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="bg-white text-primary border-0 hover:bg-white/90"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              تحديث الآن
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <div className="h-[640px] w-full">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <MapboxMap
                    pins={pins}
                    center={{ lat: 31.5017, lng: 34.4668 }}
                    zoom={12}
                    fitBounds={false}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Layer toggles & counts */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">طبقات الخريطة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.keys(LAYER_CONFIG) as LayerKey[]).map((key) => {
                  const cfg = LAYER_CONFIG[key];
                  const count = data?.[key].length ?? 0;
                  const isActive = active[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggle(key)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                        isActive
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/30 opacity-60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span className="text-foreground">{cfg.icon}</span>
                        <span className="font-semibold text-sm">{cfg.label}</span>
                      </span>
                      <Badge variant="muted" className="text-[11px]">
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ملاحظات</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  السائقون الظاهرون هم من سجّلوا موقعهم خلال الساعة الماضية فقط.
                </p>
                <p>
                  العملاء والمطاعم يظهرون فقط عند توفر إحداثيات GPS في
                  ملفاتهم.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
