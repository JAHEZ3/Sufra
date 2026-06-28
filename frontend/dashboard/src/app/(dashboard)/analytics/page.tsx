"use client";

/**
 * الإحصائيات والتقارير — لوحة تحليلات احترافية بالرسوم البيانية (recharts).
 * تقرأ بيانات حقيقية من خدمة التحليلات. لا يوجد توصيل في سُفرة، لذا أُسقطت
 * مؤشرات التوصيل.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAnalyticsReport,
  useAnalyticsOrders,
  useAnalyticsRevenue,
  useAnalyticsTopMeals,
  useAnalyticsCustomers,
  useAnalyticsPayments,
  useAnalyticsRatings,
} from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  Wallet,
  Receipt,
  Users,
  Star,
} from "lucide-react";
import type { OrderStatus, PaymentMethod, ReportPeriod } from "@/types/analytics.types";

// ─── ثوابت ───────────────────────────────────────────────────────────────────

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "يومي" },
  { value: "weekly", label: "أسبوعي" },
  { value: "monthly", label: "شهري" },
];

const BRAND = "#1f8a5b";

const STATUS_AR: Record<OrderStatus, { label: string; color: string }> = {
  pending:          { label: "قيد الانتظار", color: "#c98a1e" },
  confirmed:        { label: "مؤكد",          color: "#2a6fdb" },
  preparing:        { label: "قيد التحضير",   color: "#4f86e0" },
  ready_for_pickup: { label: "جاهز",          color: "#1f8a5b" },
  out_for_delivery: { label: "قيد التقديم",   color: "#2a6fdb" },
  delivered:        { label: "مكتمل",         color: "#1f8a5b" },
  cancelled:        { label: "ملغي",          color: "#b02500" },
  refunded:         { label: "مسترجع",        color: "#9457c4" },
};

const PAYMENT_AR: Record<PaymentMethod, { label: string; color: string }> = {
  cash_on_delivery: { label: "نقدي",   color: "#1f8a5b" },
  card:             { label: "بطاقة",  color: "#2a6fdb" },
  online:           { label: "أونلاين", color: "#9457c4" },
};

const num = (n: number) => (n ?? 0).toLocaleString("en-US");
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}/${d.getMonth() + 1}`;
};

// ─── عناصر واجهة ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-border p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-base font-black text-foreground">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Dynamic radial gauge — arc fills to |percent| (0–100), label shows the value. */
function GaugeRing({ percent, size = 60, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const up = percent >= 0;
  const fill = Math.max(0, Math.min(100, Math.abs(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (fill / 100) * c;
  const color = up ? BRAND : "#b02500";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0ec" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .7s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[12px] font-black"
        style={{ color }}
      >
        {up ? "+" : ""}
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  growth,
  icon,
  href,
}: {
  label: string;
  value: string;
  growth?: number;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-1 scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
              {icon}
            </span>
            <p className="text-[13px] font-medium text-muted-foreground truncate">{label}</p>
          </div>
          <p className="mt-3 text-2xl font-black leading-tight text-foreground">{value}</p>
        </div>
        <GaugeRing percent={growth ?? 0} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">مقارنةً بالفترة السابقة</p>
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

function ChartTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  fmt?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-lg text-xs" dir="rtl">
      {label && <p className="font-bold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">
            {fmt ? fmt(Number(p.value)) : num(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── الصفحة ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { format: sar } = useCurrency();
  const [period, setPeriod] = useState<ReportPeriod>("weekly");

  const reportQ = useAnalyticsReport(period);
  const ordersQ = useAnalyticsOrders();
  const revenueQ = useAnalyticsRevenue();
  const topMealsQ = useAnalyticsTopMeals();
  const customersQ = useAnalyticsCustomers();
  const paymentsQ = useAnalyticsPayments();
  const ratingsQ = useAnalyticsRatings();

  const report = reportQ.data;
  const orders = ordersQ.data;
  const revenue = revenueQ.data;
  const topMeals = topMealsQ.data?.top ?? [];
  const customers = customersQ.data;
  const payments = paymentsQ.data;
  const ratings = ratingsQ.data;

  const k = report?.kpis;
  const g = report?.growth;

  // الإيرادات + الطلبات آخر ٣٠ يوم
  const trend = (revenue?.last30Days ?? []).map((d) => ({
    day: dayLabel(d.day),
    revenue: d.revenue,
    orders: d.orders,
  }));

  // الطلبات حسب الساعة
  const byHour = [...(orders?.byHour ?? [])]
    .sort((a, b) => a.hour - b.hour)
    .map((h) => ({ hour: `${h.hour}:00`, count: h.count }));

  // الطلبات حسب الحالة
  const statusData = (orders?.byStatus ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({ name: STATUS_AR[s.status]?.label ?? s.status, value: s.count, color: STATUS_AR[s.status]?.color ?? "#9ca3af" }));

  // طرق الدفع
  const payData = (payments?.byMethod ?? [])
    .filter((p) => p.count > 0)
    .map((p) => ({ name: PAYMENT_AR[p.method]?.label ?? p.method, value: p.total, count: p.count, color: PAYMENT_AR[p.method]?.color ?? "#9ca3af" }));

  // الأكثر مبيعاً (أفقي)
  const mealsData = topMeals.slice(0, 6).map((m) => ({ name: m.name, revenue: m.revenue, quantity: m.quantity }));

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div dir="rtl" className="flex-1 p-6 space-y-6 bg-background overflow-y-auto">
        {/* العنوان + اختيار الفترة */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-0.5">ANALYTICS</p>
            <h1 className="text-2xl font-black text-foreground">الإحصائيات والتقارير</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{report?.label ?? "تحليل أداء مطعمك"}</p>
          </div>
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  period === p.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* بطاقات المؤشرات */}
        {reportQ.isLoading && !report ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-5 space-y-3">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="الطلبات" value={num(k?.orders ?? 0)} growth={g?.ordersPct} icon={<ShoppingBag className="h-4.5 w-4.5" />} href="/orders" />
            <KpiCard label="الإيرادات" value={sar(k?.revenue ?? 0)} growth={g?.revenuePct} icon={<Wallet className="h-4.5 w-4.5" />} href="/accounting" />
            <KpiCard label="متوسط قيمة الطلب" value={sar(k?.avgOrderValue ?? 0)} growth={g?.avgOrderValuePct} icon={<Receipt className="h-4.5 w-4.5" />} href="/orders" />
            <KpiCard label="العملاء" value={num(k?.uniqueCustomers ?? 0)} growth={g?.customersPct} icon={<Users className="h-4.5 w-4.5" />} href="/orders" />
          </div>
        )}

        {/* اتجاه الإيرادات (Area) */}
        <Card>
          <SectionTitle hint="آخر ٣٠ يوم">اتجاه الإيرادات</SectionTitle>
          {revenueQ.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : trend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-20 text-center">لا توجد بيانات بعد</p>
          ) : (
            <div dir="ltr" className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0ec" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#5f6b64" }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: "#5f6b64" }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip fmt={sar} />} />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke={BRAND} strokeWidth={2.5} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* الطلبات حسب الساعة (Bar) + حالة الطلبات (Donut) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <SectionTitle hint="اليوم">الطلبات حسب الساعة</SectionTitle>
            {ordersQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : byHour.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">لا توجد بيانات بعد</p>
            ) : (
              <div dir="ltr" className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byHour} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0ec" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#5f6b64" }} tickLine={false} axisLine={false} minTickGap={12} />
                    <YAxis tick={{ fontSize: 11, fill: "#5f6b64" }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(31,138,91,0.06)" }} />
                    <Bar dataKey="count" name="طلبات" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>الطلبات حسب الحالة</SectionTitle>
            {ordersQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">لا توجد طلبات بعد</p>
            ) : (
              <div dir="ltr" className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(v) => <span className="text-xs text-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* الأكثر مبيعاً (أفقي) + طرق الدفع (Donut) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <SectionTitle>الأكثر مبيعاً</SectionTitle>
            {topMealsQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : mealsData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">لا توجد مبيعات بعد</p>
            ) : (
              <div dir="ltr" className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mealsData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0ec" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#5f6b64" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#16201b" }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip content={<ChartTooltip fmt={sar} />} cursor={{ fill: "rgba(31,138,91,0.06)" }} />
                    <Bar dataKey="revenue" name="الإيرادات" fill={BRAND} radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>طرق الدفع</SectionTitle>
            {paymentsQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : payData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">لا توجد مدفوعات بعد</p>
            ) : (
              <div dir="ltr" className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={payData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                      {payData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip fmt={sar} />} />
                    <Legend formatter={(v) => <span className="text-xs text-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* العملاء + التقييمات */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <SectionTitle>العملاء</SectionTitle>
            {customersQ.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="إجمالي العملاء" value={num(customers?.total ?? 0)} />
                <Stat label="نشطون (٣٠ يوم)" value={num(customers?.activeLast30Days ?? 0)} />
                <Stat label="عملاء متكررون" value={num(customers?.repeatCustomers ?? 0)} />
                <Stat label="نسبة التكرار" value={`${Math.round(customers?.repeatRate ?? 0)}%`} />
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>التقييمات</SectionTitle>
            {ratingsQ.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                  <span className="text-3xl font-black text-foreground">
                    {(ratings?.avgFoodRating ?? 0).toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    من {num(ratings?.totalRatings ?? 0)} تقييم
                  </span>
                </div>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratings?.distribution?.find((d) => d.stars === stars)?.count ?? 0;
                    const total = Math.max(1, ratings?.totalRatings ?? 0);
                    return (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">{stars} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-left">{num(count)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-black text-foreground mt-1">{value}</p>
    </div>
  );
}
