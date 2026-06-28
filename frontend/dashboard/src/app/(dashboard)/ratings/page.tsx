"use client";

import { useMemo, useState } from "react";
import {
  Star,
  MessageSquare,
  Truck,
  UtensilsCrossed,
  Users,
  Store,
  ArrowUpDown,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsReviews, useRestaurantReviews } from "@/hooks/useAnalytics";
import type {
  Review,
  RestaurantReview,
  RestaurantReviewSort,
} from "@/types/analytics.types";

const PAGE_SIZE = 10;

function formatDate(d: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

// ─── Shared presentational pieces ─────────────────────────────────────────────

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const filled = Math.round(value);
  const px = size === "lg" ? "w-6 h-6" : "w-4 h-4";
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

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
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
      <p className="text-2xl font-black text-foreground tabular-nums">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

function DistributionRow({
  stars,
  count,
  total,
}: {
  stars: number;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-6 text-muted-foreground tabular-nums">{stars}</span>
      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-left text-xs font-medium text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

function DistributionPanel({
  distribution,
  total,
  isLoading,
}: {
  distribution: { stars: number; count: number }[];
  total: number;
  isLoading: boolean;
}) {
  const map = new Map(distribution.map((d) => [d.stars, d.count]));
  return (
    <div className="bg-white rounded-xl border border-border p-5 h-fit">
      <h3 className="text-base font-bold text-foreground mb-4">توزيع التقييمات</h3>
      {isLoading ? (
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((s) => (
            <Skeleton key={s} className="h-6" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((s) => (
            <DistributionRow
              key={s}
              stars={s}
              count={map.get(s) ?? 0}
              total={total}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
      >
        السابق
      </button>
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
      >
        التالي
      </button>
    </div>
  );
}

function EmptyReviews() {
  return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <Star className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">لا توجد تقييمات بعد</p>
      <p className="text-xs text-muted-foreground mt-1">
        ستظهر هنا بمجرد أن يقيّم العملاء مطعمك
      </p>
    </div>
  );
}

// ─── Tab 1: Restaurant reviews (standalone customer ratings) ───────────────────

const SORT_OPTIONS: { key: RestaurantReviewSort; label: string }[] = [
  { key: "latest", label: "الأحدث" },
  { key: "highest", label: "الأعلى" },
  { key: "lowest", label: "الأدنى" },
];

function RestaurantReviewCard({ review }: { review: RestaurantReview }) {
  const label = `عميل #${review.userId.slice(0, 6).toUpperCase()}`;
  // Negative reviews get a soft, non-alarming tint — never harsh red.
  const isLow = review.rating <= 2;
  return (
    <article className="bg-white rounded-xl border border-border p-5 hover:shadow-md hover:border-border/80 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {label[5] ?? "ع"}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Stars value={review.rating} />
          <span className="text-sm font-bold text-foreground tabular-nums">
            {review.rating.toFixed(1)}
          </span>
        </div>
      </div>

      {review.comment && (
        <div
          className={`flex gap-2 text-sm text-foreground rounded-lg p-3 border ${
            isLow
              ? "bg-slate-50 border-slate-100"
              : "bg-amber-50/50 border-amber-100"
          }`}
        >
          <MessageSquare
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              isLow ? "text-slate-400" : "text-amber-500"
            }`}
          />
          <p className="leading-relaxed whitespace-pre-wrap">{review.comment}</p>
        </div>
      )}
    </article>
  );
}

function RestaurantReviewsTab() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<RestaurantReviewSort>("latest");
  const { data, isLoading, isFetching } = useRestaurantReviews(
    page,
    PAGE_SIZE,
    sort,
  );

  const summary = data?.summary;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Share of 4★+5★ ratings — a quick reputation health signal.
  const satisfactionPct = useMemo(() => {
    const dist = summary?.distribution ?? [];
    const totalCount = dist.reduce((s, d) => s + d.count, 0);
    if (totalCount === 0) return 0;
    const happy = dist
      .filter((d) => d.stars >= 4)
      .reduce((s, d) => s + d.count, 0);
    return Math.round((happy / totalCount) * 100);
  }, [summary]);

  const onSort = (next: RestaurantReviewSort) => {
    setSort(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<Star className="w-5 h-5 text-amber-600" />}
              color="bg-amber-50"
              label="متوسط التقييم"
              value={(summary?.average ?? 0).toFixed(2)}
              sub={<Stars value={summary?.average ?? 0} size="lg" />}
            />
            <StatCard
              icon={<Store className="w-5 h-5 text-emerald-600" />}
              color="bg-emerald-50"
              label="إجمالي التقييمات"
              value={summary?.total ?? 0}
            />
            <StatCard
              icon={<Star className="w-5 h-5 text-rose-600" />}
              color="bg-rose-50"
              label="نسبة الرضا (4 نجوم فأعلى)"
              value={`${satisfactionPct}%`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DistributionPanel
            distribution={summary?.distribution ?? []}
            total={summary?.total ?? 0}
            isLoading={isLoading}
          />
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-foreground">آراء العملاء</h3>
            {/* Sort control */}
            <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onSort(opt.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    sort === opt.key
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : items.length === 0 ? (
            <EmptyReviews />
          ) : (
            <div
              className={`space-y-3 transition-opacity duration-200 ${
                isFetching ? "opacity-60" : "opacity-100"
              }`}
            >
              {items.map((r) => (
                <RestaurantReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Order ratings (existing food + delivery view) ──────────────────────

function OrderReviewCard({ review }: { review: Review }) {
  const label = `عميل #${review.customerId.slice(0, 6).toUpperCase()}`;
  return (
    <article className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {label[5] ?? "ع"}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>
        <Stars value={review.foodRating} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
          <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
          <span className="text-muted-foreground">الطعام</span>
          <span className="font-bold text-foreground tabular-nums mr-auto">
            {review.foodRating.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
          <Truck className="w-4 h-4 text-indigo-500" />
          <span className="text-muted-foreground">التوصيل</span>
          <span className="font-bold text-foreground tabular-nums mr-auto">
            {review.deliveryRating.toFixed(1)}
          </span>
        </div>
      </div>

      {review.comment && (
        <div className="flex gap-2 text-sm text-foreground bg-amber-50/50 border border-amber-100 rounded-lg p-3">
          <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed whitespace-pre-wrap">{review.comment}</p>
        </div>
      )}
    </article>
  );
}

function OrderRatingsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAnalyticsReviews(page, PAGE_SIZE);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<Star className="w-5 h-5 text-amber-600" />}
              color="bg-amber-50"
              label="متوسط تقييم الطعام"
              value={(summary?.avgFoodRating ?? 0).toFixed(2)}
              sub={<Stars value={summary?.avgFoodRating ?? 0} size="lg" />}
            />
            <StatCard
              icon={<Truck className="w-5 h-5 text-indigo-600" />}
              color="bg-indigo-50"
              label="متوسط تقييم التوصيل"
              value={(summary?.avgDeliveryRating ?? 0).toFixed(2)}
              sub={<Stars value={summary?.avgDeliveryRating ?? 0} size="lg" />}
            />
            <StatCard
              icon={<Users className="w-5 h-5 text-emerald-600" />}
              color="bg-emerald-50"
              label="إجمالي التقييمات"
              value={summary?.totalRatings ?? 0}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DistributionPanel
            distribution={summary?.distribution ?? []}
            total={summary?.totalRatings ?? 0}
            isLoading={isLoading}
          />
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">آراء العملاء</h3>
            {!isLoading && total > 0 && (
              <span className="text-xs text-muted-foreground">{total} تقييم</span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : items.length === 0 ? (
            <EmptyReviews />
          ) : (
            <div className="space-y-3">
              {items.map((r) => (
                <OrderReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type TabKey = "restaurant" | "order";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "restaurant", label: "تقييمات المطعم", icon: <Store className="w-4 h-4" /> },
  { key: "order", label: "تقييمات الطلبات", icon: <Truck className="w-4 h-4" /> },
];

export default function RatingsPage() {
  const [tab, setTab] = useState<TabKey>("restaurant");

  const subtitle = useMemo(
    () =>
      tab === "restaurant"
        ? "تقييمات العملاء لمطعمك من التطبيق"
        : "تقييمات العملاء لطلباتهم (الطعام والتوصيل)",
    [tab],
  );

  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">التقييمات</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex items-center gap-1 bg-muted/60 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "restaurant" ? <RestaurantReviewsTab /> : <OrderRatingsTab />}
      </div>
    </>
  );
}
