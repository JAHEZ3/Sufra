"use client";

import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Store, ShoppingBag, TrendingUp,
  CircleDollarSign, Bike, Clock,
} from "lucide-react";
import {
  useAnalyticsOverview,
  useOrdersAnalytics,
} from "@/hooks/useAnalytics";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { OverviewAnalytics, OrdersAnalytics } from "@/types/analytics.types";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const buildCards = (o: OverviewAnalytics, pendingOrders: number) => [
  {
    title: "إجمالي المستخدمين",
    value: formatNumber(o.users.total),
    sub: `${formatNumber(o.customers.newToday)} عميل جديد اليوم`,
    icon: Users,
    color: "#2a6fdb",
    bg: "#eff6ff",
  },
  {
    title: "المطاعم المسجّلة",
    value: formatNumber(o.restaurants.total),
    sub: `${formatNumber(o.restaurants.openNow)} مفتوح الآن`,
    icon: Store,
    color: "#1f8a5b",
    bg: "#e6f2ec",
  },
  {
    title: "إجمالي الطلبات",
    value: formatNumber(o.orders.total),
    sub: `${formatNumber(o.orders.today)} طلب اليوم`,
    icon: ShoppingBag,
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    title: "إجمالي الإيرادات",
    value: formatCurrency(o.revenue.total),
    sub: `${formatCurrency(o.revenue.today)} اليوم`,
    icon: CircleDollarSign,
    color: "#9457c4",
    bg: "#f5f3ff",
  },
  {
    title: "سائقو التوصيل النشطون",
    value: formatNumber(o.agents.active),
    sub: `${formatNumber(o.agents.total)} إجمالي السائقين`,
    icon: Bike,
    color: "#c98a1e",
    bg: "#fffbeb",
  },
  {
    title: "الطلبات المعلّقة",
    value: formatNumber(pendingOrders),
    sub: "بانتظار التأكيد",
    icon: Clock,
    color: "#ef4444",
    bg: "#fef2f2",
  },
];

const last7DaysChart = (orders: OrdersAnalytics | undefined) => {
  if (!orders?.last30Days?.length) return [];
  return orders.last30Days.slice(-7).map((p) => {
    const d = new Date(p.day);
    const label = Number.isNaN(d.getTime())
      ? p.day
      : WEEKDAYS_AR[d.getDay()];
    return { label, revenue: p.revenue, orders: p.orders };
  });
};

const pendingFromOrders = (orders: OrdersAnalytics | undefined): number => {
  if (!orders?.byStatus) return 0;
  return orders.byStatus
    .filter((b) => b.status === "pending" || b.status === "confirmed")
    .reduce((sum, b) => sum + b.count, 0);
};

export default function OverviewPage() {
  const overviewQ = useAnalyticsOverview();
  const ordersQ = useOrdersAnalytics();

  const isLoading = overviewQ.isLoading || ordersQ.isLoading;
  const overview = overviewQ.data;
  const orders = ordersQ.data;

  const cards = overview ? buildCards(overview, pendingFromOrders(orders)) : [];
  const chartData = last7DaysChart(orders);

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="نظرة عامة" subtitle="مرحباً، هذا ملخص المنصة اليوم" />

      <div className="p-6 space-y-6 animate-fade-in-up">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading || !overview
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))
            : cards.map((card) => (
                <Card key={card.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: card.bg }}
                    >
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <p className="text-2xl font-black text-foreground">{card.value}</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{card.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Chart */}
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>الإيرادات والطلبات – آخر 7 أيام</CardTitle>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {ordersQ.isLoading ? (
                <Skeleton className="h-52 rounded-xl" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  لا توجد بيانات لعرضها بعد.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1f8a5b" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#1f8a5b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "Cairo" }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "Cairo" }} width={60} />
                    <Tooltip
                      contentStyle={{ fontFamily: "Cairo", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [formatCurrency(v), "الإيرادات"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#1f8a5b"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
