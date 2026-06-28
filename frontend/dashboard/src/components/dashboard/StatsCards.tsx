"use client";

import { Star, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { useDashboardStats } from "@/hooks/useRestaurant";
import { CardSkeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; positive: boolean };
}

function StatCard({ icon, iconBg, label, value, sub, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-black text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        {trend && (
          <span
            className={`text-[11px] font-semibold mt-1 inline-block ${
              trend.positive ? "text-success" : "text-error"
            }`}
          >
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsCards() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  // Fallback mock data for display when backend not connected
  const s = stats ?? {
    rating: 5.0,
    totalRatings: 48,
    totalOrders: 184,
    todayOrders: 12,
    totalRevenue: 12450,
    todayRevenue: 890,
    pendingOrders: 3,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        icon={<Star className="w-6 h-6 text-amber-500 fill-amber-500" />}
        iconBg="bg-amber-50"
        label="تقييم العملاء"
        value={`${s.rating.toFixed(1)} / 5`}
        sub={`${s.totalRatings} تقييم`}
        trend={{ value: "0.2 هذا الشهر", positive: true }}
      />
      <StatCard
        icon={<ShoppingBag className="w-6 h-6 text-primary" />}
        iconBg="bg-primary-light"
        label="إجمالي الطلبات"
        value={s.totalOrders.toString()}
        sub={`${s.todayOrders} اليوم`}
        trend={{ value: "13٪ مقارنة بالأمس", positive: true }}
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6 text-success" />}
        iconBg="bg-success-light"
        label="إجمالي المبيعات"
        value={`SR ${s.totalRevenue.toLocaleString("ar-SA")}`}
        sub={`تحديث للحظة`}
        trend={{ value: "8٪ هذا الأسبوع", positive: true }}
      />
      <StatCard
        icon={<Clock className="w-6 h-6 text-info" />}
        iconBg="bg-info-light"
        label="طلبات معلقة"
        value={s.pendingOrders.toString()}
        sub="تحتاج إلى مراجعة"
        trend={{ value: "تحديث مستمر", positive: true }}
      />
    </div>
  );
}
