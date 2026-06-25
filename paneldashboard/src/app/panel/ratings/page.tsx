"use client";

import { useMemo, useState } from "react";
import {
  Star,
  Search,
  Eye,
  MessageSquare,
  UtensilsCrossed,
  Truck,
  Award,
  Users as UsersIcon,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { useRestaurants, useRestaurantReviews } from "@/hooks/useRestaurants";
import { RestaurantStatus, type Restaurant } from "@/types/restaurant.types";
import {
  restaurantStatusBadgeVariant,
  restaurantStatusLabel,
} from "@/components/restaurants/restaurant-labels";
import { Badge } from "@/components/ui/badge";

type SortKey = "rating-desc" | "rating-asc" | "ratings-desc" | "ratings-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "rating-desc": "الأعلى تقييماً",
  "rating-asc": "الأقل تقييماً",
  "ratings-desc": "الأكثر تقييمات",
  "ratings-asc": "الأقل تقييمات",
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const filled = Math.round(value);
  const px = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${px} ${
            i <= filled
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ReviewsDialog({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const open = !!restaurant;
  const { data, isLoading } = useRestaurantReviews(restaurant?.id, page, 10);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const distribution = new Map<number, number>();
  data?.summary.distribution.forEach((d) => distribution.set(d.stars, d.count));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPage(1);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{restaurant?.name ?? "تقييمات المطعم"}</DialogTitle>
          <DialogDescription>
            عرض جميع تقييمات وآراء العملاء على هذا المطعم
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-amber-700">متوسط الطعام</p>
              <p className="text-2xl font-black text-foreground tabular-nums mt-1">
                {(data?.summary.avgFoodRating ?? 0).toFixed(2)}
              </p>
              <div className="flex justify-center mt-1">
                <Stars value={data?.summary.avgFoodRating ?? 0} />
              </div>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-indigo-700">
                متوسط التوصيل
              </p>
              <p className="text-2xl font-black text-foreground tabular-nums mt-1">
                {(data?.summary.avgDeliveryRating ?? 0).toFixed(2)}
              </p>
              <div className="flex justify-center mt-1">
                <Stars value={data?.summary.avgDeliveryRating ?? 0} />
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-emerald-700">
                إجمالي التقييمات
              </p>
              <p className="text-2xl font-black text-foreground tabular-nums mt-1">
                {data?.summary.totalRatings ?? 0}
              </p>
            </div>
          </div>

          {/* Distribution */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = distribution.get(s) ?? 0;
              const pct =
                (data?.summary.totalRatings ?? 0) > 0
                  ? (count / (data?.summary.totalRatings ?? 1)) * 100
                  : 0;
              return (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-muted-foreground tabular-nums">
                    {s}
                  </span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-left text-xs font-medium text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reviews list */}
          <div className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : (data?.items ?? []).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                لا توجد تقييمات بعد
              </div>
            ) : (
              data!.items.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        عميل #{r.customerId.slice(0, 6).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <Stars value={r.foodRating} />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" />
                      الطعام {r.foodRating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-indigo-500" />
                      التوصيل {r.deliveryRating.toFixed(1)}
                    </span>
                  </div>
                  {r.comment && (
                    <div className="flex gap-2 text-sm text-foreground bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                      <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {r.comment}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                السابق
              </button>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                التالي
              </button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function PanelRatingsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("rating-desc");
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const { data, isLoading } = useRestaurants({
    status: RestaurantStatus.ACTIVE,
    search: search.trim() || undefined,
    page: 1,
    limit: 100,
  });

  const restaurants = data?.items ?? [];

  const sorted = useMemo(() => {
    const list = [...restaurants];
    list.sort((a, b) => {
      switch (sort) {
        case "rating-desc":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "rating-asc":
          return (a.rating ?? 0) - (b.rating ?? 0);
        case "ratings-desc":
          return (b.totalRatings ?? 0) - (a.totalRatings ?? 0);
        case "ratings-asc":
          return (a.totalRatings ?? 0) - (b.totalRatings ?? 0);
      }
    });
    return list;
  }, [restaurants, sort]);

  const platformStats = useMemo(() => {
    const totalRatings = restaurants.reduce(
      (sum, r) => sum + (r.totalRatings ?? 0),
      0,
    );
    const rated = restaurants.filter((r) => (r.totalRatings ?? 0) > 0);
    const weightedAvg =
      totalRatings > 0
        ? rated.reduce(
            (sum, r) => sum + (r.rating ?? 0) * (r.totalRatings ?? 0),
            0,
          ) / totalRatings
        : 0;
    const topRated = rated.length
      ? rated.reduce((best, r) =>
          (r.rating ?? 0) > (best.rating ?? 0) ? r : best,
        )
      : null;
    return {
      totalRatings,
      ratedRestaurants: rated.length,
      weightedAvg,
      topRated,
    };
  }, [restaurants]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="التقييمات"
        subtitle="استعراض تقييمات العملاء لجميع المطاعم النشطة"
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Platform stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatTile
            icon={<Star className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50"
            label="متوسط التقييمات"
            value={platformStats.weightedAvg.toFixed(2)}
          />
          <StatTile
            icon={<UsersIcon className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            label="إجمالي التقييمات"
            value={platformStats.totalRatings}
          />
          <StatTile
            icon={<Award className="w-5 h-5 text-indigo-600" />}
            color="bg-indigo-50"
            label="مطاعم تمّ تقييمها"
            value={platformStats.ratedRestaurants}
          />
          <StatTile
            icon={<Star className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            label="الأعلى تقييماً"
            value={
              platformStats.topRated?.name ??
              <span className="text-base text-muted-foreground">—</span>
            }
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="ابحث عن مطعم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  sort === k
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground border-border hover:bg-muted"
                }`}
              >
                {SORT_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        {/* Restaurants table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  المطعم
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  المدينة
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الحالة
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  التقييم
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  عدد التقييمات
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-5 py-4" colSpan={6}>
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    لا توجد مطاعم مطابقة
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {r.name?.[0] ?? "م"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {r.name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.phone ?? ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {r.city ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={restaurantStatusBadgeVariant(r.status)}>
                        {restaurantStatusLabel[r.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating ?? 0} />
                        <span className="text-sm font-bold tabular-nums">
                          {Number(r.rating ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-foreground tabular-nums">
                      {r.totalRatings ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelected(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض التقييمات
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReviewsDialog
        restaurant={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
