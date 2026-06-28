"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, MoreVertical, CheckCircle,
  XCircle, Trash2, Eye, Store, MapPin, Phone,
  Star,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminRestaurantsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";

type RestaurantStatus = "all" | "active" | "pending" | "suspended";

interface Restaurant {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  city: string;
  status: "active" | "pending" | "suspended";
  rating: number;
  totalOrders: number;
  totalRevenue: number;
  createdAt: string;
  category: string;
}

const mockRestaurants: Restaurant[] = [
  { id: "1", name: "مطعم الأصالة",    ownerName: "أحمد الشمري",    phone: "0501234567", city: "الرياض",  status: "active",    rating: 4.8, totalOrders: 1240, totalRevenue: 185000, createdAt: "2024-01-15", category: "مندي" },
  { id: "2", name: "برجر هاوس",       ownerName: "خالد المطيري",   phone: "0544332211", city: "جدة",     status: "active",    rating: 4.5, totalOrders: 780,  totalRevenue: 92000,  createdAt: "2024-04-01", category: "وجبات سريعة" },
  { id: "3", name: "مندي الخير",      ownerName: "ريم الحربي",     phone: "0567891234", city: "مكة",     status: "pending",   rating: 0,   totalOrders: 0,    totalRevenue: 0,      createdAt: "2024-06-10", category: "مندي" },
  { id: "4", name: "بيتزا عالم",      ownerName: "سعد التميمي",    phone: "0512233445", city: "الرياض",  status: "active",    rating: 4.2, totalOrders: 540,  totalRevenue: 67000,  createdAt: "2024-02-20", category: "بيتزا" },
  { id: "5", name: "سوشي تايم",       ownerName: "ليلى الأحمدي",   phone: "0598877665", city: "الدمام",  status: "suspended", rating: 3.1, totalOrders: 120,  totalRevenue: 22000,  createdAt: "2024-03-05", category: "ياباني" },
  { id: "6", name: "شاورما نجد",      ownerName: "فيصل العسيري",   phone: "0534455667", city: "الطائف",  status: "active",    rating: 4.6, totalOrders: 2100, totalRevenue: 210000, createdAt: "2023-12-01", category: "شاورما" },
  { id: "7", name: "ستيك & مور",      ownerName: "منى الجهني",     phone: "0523456789", city: "جدة",     status: "pending",   rating: 0,   totalOrders: 0,    totalRevenue: 0,      createdAt: "2024-07-02", category: "ستيك" },
];

const statusLabels: Record<RestaurantStatus, string> = {
  all: "الكل", active: "نشط", pending: "بانتظار الموافقة", suspended: "موقوف",
};

const statusBadgeVariant = (status: Restaurant["status"]) => {
  if (status === "active")    return "success" as const;
  if (status === "pending")   return "warning" as const;
  return "error" as const;
};

function formatRating(rating: Restaurant["rating"]) {
  const numericRating = Number(rating ?? 0);
  return Number.isFinite(numericRating) ? numericRating.toFixed(1) : "0.0";
}

export default function RestaurantsPage() {
  const [activeStatus, setActiveStatus] = useState<RestaurantStatus>("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useQuery<Restaurant[]>({
    queryKey: queryKeys.restaurants.all({ status: activeStatus }),
    queryFn: async () => {
      const res = await adminRestaurantsApi.getAll({
        status: activeStatus === "all" ? undefined : activeStatus,
      });
      return res.data;
    },
    placeholderData: mockRestaurants,
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminRestaurantsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurants"] });
      success("تمت الموافقة على المطعم");
      setOpenMenuId(null);
    },
    onError: () => error("خطأ", "تعذّر الموافقة على المطعم"),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => adminRestaurantsApi.suspend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurants"] });
      success("تم إيقاف المطعم");
      setOpenMenuId(null);
    },
    onError: () => error("خطأ", "تعذّر إيقاف المطعم"),
  });

  const restaurants = data ?? mockRestaurants;

  const filtered = restaurants.filter((r) => {
    const matchStatus = activeStatus === "all" || r.status === activeStatus;
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      r.city.includes(search);
    return matchStatus && matchSearch;
  });

  const counts: Record<RestaurantStatus, number> = {
    all:       restaurants.length,
    active:    restaurants.filter((r) => r.status === "active").length,
    pending:   restaurants.filter((r) => r.status === "pending").length,
    suspended: restaurants.filter((r) => r.status === "suspended").length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="المطاعم" subtitle="إدارة جميع المطاعم المسجّلة في المنصة" />

      <div className="p-6 space-y-5 animate-fade-in-up">

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "pending", "suspended"] as RestaurantStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                activeStatus === s
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {statusLabels[s]}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeStatus === s ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="بحث بالاسم، المالك، أو المدينة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4" />
            تصفية
          </Button>
        </div>

        {/* Grid cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد مطاعم تطابق البحث
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow relative"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
                      style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
                    >
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.category}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === r.id && (
                      <div className="absolute left-0 top-9 z-20 bg-white rounded-xl border border-border shadow-lg py-1 w-44 animate-scale-in">
                        <button className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted">
                          <Eye className="w-4 h-4 text-info" /> عرض التفاصيل
                        </button>
                        {r.status === "pending" && (
                          <button
                            onClick={() => approve.mutate(r.id)}
                            className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted"
                          >
                            <CheckCircle className="w-4 h-4 text-success" /> الموافقة
                          </button>
                        )}
                        {r.status === "active" && (
                          <button
                            onClick={() => suspend.mutate(r.id)}
                            className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted"
                          >
                            <XCircle className="w-4 h-4 text-warning" /> إيقاف مؤقت
                          </button>
                        )}
                        <div className="border-t border-border my-1" />
                        <button className="flex items-center gap-2 px-3 py-2 w-full text-sm text-error hover:bg-error-light">
                          <Trash2 className="w-4 h-4" /> حذف
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />{r.ownerName} – {r.phone}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />{r.city}
                  </div>
                  {r.status === "active" && (
                    <div className="flex items-center gap-1.5 text-xs text-warning font-semibold">
                      <Star className="w-3.5 h-3.5 fill-warning" />
                      {formatRating(r.rating)}
                    </div>
                  )}
                </div>

                {/* Stats */}
                {r.status === "active" && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <p className="text-base font-black text-foreground">{formatNumber(r.totalOrders)}</p>
                      <p className="text-[10px] text-muted-foreground">طلب</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <p className="text-base font-black text-foreground">{formatCurrency(r.totalRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">إيرادات</p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {statusLabels[r.status]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
