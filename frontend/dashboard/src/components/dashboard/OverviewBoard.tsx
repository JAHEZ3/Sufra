"use client";

/**
 * نظرة عامة — اللوحة الرئيسية للمطعم.
 * تقرأ بيانات حقيقية من خدمة التحليلات (analytics) في restaurant-service.
 */

import Link from "next/link";
import {
  useAnalyticsOverview,
  useAnalyticsOrders,
  useAnalyticsRevenue,
  useAnalyticsTopMeals,
} from "@/hooks/useAnalytics";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useCurrency } from "@/hooks/useCurrency";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  ShoppingBag,
  Receipt,
  CalendarDays,
  TrendingUp,
  Banknote,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OrderStatus } from "@/types/analytics.types";

// ─── أدوات مساعدة ──────────────────────────────────────────────────────────────

const num = (n: number) => (n ?? 0).toLocaleString("en-US");

const todayLabel = new Date().toLocaleDateString("ar-EG", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const STATUS_AR: Record<OrderStatus, { label: string; color: string }> = {
  pending:          { label: "قيد الانتظار", color: "#c98a1e" },
  confirmed:        { label: "مؤكد",          color: "#2a6fdb" },
  preparing:        { label: "قيد التحضير",   color: "#2a6fdb" },
  ready_for_pickup: { label: "جاهز",          color: "#1f8a5b" },
  out_for_delivery: { label: "قيد التقديم",   color: "#2a6fdb" },
  delivered:        { label: "مكتمل",         color: "#1f8a5b" },
  cancelled:        { label: "ملغي",          color: "#b02500" },
  refunded:         { label: "مسترجع",        color: "#9457c4" },
};

// ─── عناصر واجهة ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-border p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-black text-foreground">{children}</h2>;
}

// هيكل تحميل بنفس تخطيط اللوحة
function OverviewBoardSkeleton() {
  return (
    <div dir="rtl" className="flex-1 p-6 space-y-6 bg-background overflow-y-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border p-5 space-y-3">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-72 xl:col-span-2 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      {/* شريط لوني علوي بلون العلامة */}
      <span className="absolute inset-x-0 top-0 h-1 scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            {icon}
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl font-black leading-tight text-foreground">{value}</p>

      {sub && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
          {sub}
        </p>
      )}
    </>
  );

  const className =
    "group relative block overflow-hidden rounded-2xl border border-border bg-white p-5 transition-all hover:border-primary/40 hover:shadow-md";

  if (href) {
    return (
      <Link href={href} className={`${className} cursor-pointer hover:-translate-y-0.5`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

// ─── اللوحة ────────────────────────────────────────────────────────────────────

export function OverviewBoard() {
  const { format: sar } = useCurrency();
  const { data: restaurant } = useRestaurant();
  const { data: ov, isLoading } = useAnalyticsOverview();
  const { data: orders } = useAnalyticsOrders();
  const { data: revenue } = useAnalyticsRevenue();
  const { data: topMealsData } = useAnalyticsTopMeals();

  if (isLoading) {
    return <OverviewBoardSkeleton />;
  }

  const rev = ov?.revenue;
  const ord = ov?.orders;

  const kpis = [
    { label: "إيرادات اليوم", value: sar(rev?.today ?? 0), sub: "محدّث الآن", icon: <Wallet className="h-4.5 w-4.5" />, href: "/analytics" },
    { label: "طلبات اليوم", value: num(ord?.today ?? 0), sub: `${num(ord?.pending ?? 0)} قيد الانتظار`, icon: <ShoppingBag className="h-4.5 w-4.5" />, href: "/orders" },
    { label: "متوسط قيمة الطلب", value: sar(rev?.avgOrderValue ?? 0), sub: "لكل طلب", icon: <Receipt className="h-4.5 w-4.5" />, href: "/analytics" },
    { label: "طلبات الشهر", value: num(ord?.month ?? 0), sub: `${num(ord?.week ?? 0)} هذا الأسبوع`, icon: <CalendarDays className="h-4.5 w-4.5" />, href: "/orders" },
    { label: "إيرادات الشهر", value: sar(rev?.month ?? 0), sub: `نسبة الإكمال ${Math.round((ov?.rates?.completionRate ?? 0))}%`, icon: <TrendingUp className="h-4.5 w-4.5" />, href: "/analytics" },
    { label: "إجمالي الإيرادات", value: sar(rev?.total ?? 0), sub: `${num(rev?.paidOrders ?? 0)} طلب مدفوع`, icon: <Banknote className="h-4.5 w-4.5" />, href: "/analytics" },
  ];

  // الطلبات حسب الساعة
  const byHour = [...(orders?.byHour ?? [])].sort((a, b) => a.hour - b.hour);
  const maxHour = Math.max(1, ...byHour.map((h) => h.count));

  // الأكثر مبيعاً
  const topMeals = topMealsData?.top ?? [];
  const maxMealRev = Math.max(1, ...topMeals.map((m) => m.revenue));

  // الطلبات حسب الحالة
  const byStatus = (orders?.byStatus ?? []).filter((s) => s.count > 0);
  const totalStatus = Math.max(1, byStatus.reduce((sum, s) => sum + s.count, 0));

  // الإيرادات آخر ٣٠ يوم
  const last30 = revenue?.last30Days ?? [];
  const maxDayRev = Math.max(1, ...last30.map((d) => d.revenue));

  return (
    <div dir="rtl" className="flex-1 p-6 space-y-6 bg-background overflow-y-auto">
      {/* العنوان */}
      <div>
        <h1 className="text-3xl font-black text-foreground">نظرة عامة</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {restaurant?.name ?? "مطعمي"} · {todayLabel}
        </p>
      </div>

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* الطلبات حسب الساعة + الأكثر مبيعاً */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <SectionTitle>الطلبات حسب الساعة</SectionTitle>
            <span className="text-xs text-muted-foreground">اليوم</span>
          </div>
          {byHour.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">لا توجد بيانات بعد</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-56">
              {byHour.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    className="w-full max-w-[42px] rounded-md bg-primary/80"
                    style={{ height: `${(h.count / maxHour) * 100}%` }}
                    title={`${h.count} طلب`}
                  />
                  <span className="text-[11px] text-muted-foreground">{h.hour}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>الأكثر مبيعاً</SectionTitle>
          {topMeals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">لا توجد مبيعات بعد</p>
          ) : (
            <div className="mt-5 space-y-4">
              {topMeals.slice(0, 5).map((m) => (
                <div key={m.mealId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {num(m.quantity)} مباع · {sar(m.revenue)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(m.revenue / maxMealRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* الطلبات حسب الحالة + الإيرادات آخر ٣٠ يوم */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <SectionTitle>الطلبات حسب الحالة</SectionTitle>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">لا توجد طلبات بعد</p>
          ) : (
            <>
              <div className="mt-5 flex h-3 rounded-full overflow-hidden">
                {byStatus.map((s) => (
                  <div
                    key={s.status}
                    style={{ width: `${(s.count / totalStatus) * 100}%`, background: STATUS_AR[s.status]?.color ?? "#9ca3af" }}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {byStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_AR[s.status]?.color ?? "#9ca3af" }} />
                    <span className="text-xs text-foreground font-medium">{STATUS_AR[s.status]?.label ?? s.status}</span>
                    <span className="text-xs text-muted-foreground">{num(s.count)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>الإيرادات</SectionTitle>
            <span className="text-xs text-muted-foreground">آخر ٣٠ يوم</span>
          </div>
          {last30.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">لا توجد بيانات بعد</p>
          ) : (
            <div className="mt-5 flex items-end gap-1 h-40">
              {last30.map((d) => (
                <div
                  key={d.day}
                  className="flex-1 rounded-sm bg-primary/70 hover:bg-primary transition-colors"
                  style={{ height: `${Math.max(2, (d.revenue / maxDayRev) * 100)}%` }}
                  title={`${d.day}: ${sar(d.revenue)}`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* المخزون */}
      <InventoryOverview />
    </div>
  );
}
