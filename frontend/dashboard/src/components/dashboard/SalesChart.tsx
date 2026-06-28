"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useSalesData } from "@/hooks/useRestaurant";
import { cn } from "@/lib/utils";

const periods = [
  { value: "daily",   label: "يومي"  },
  { value: "weekly",  label: "أسبوعي" },
  { value: "monthly", label: "شهري"  },
] as const;

// Mock data used when backend is not available
const mockData = {
  daily: [
    { date: "السبت",    revenue: 1200, orders: 18 },
    { date: "الأحد",    revenue: 980,  orders: 14 },
    { date: "الإثنين",  revenue: 1450, orders: 22 },
    { date: "الثلاثاء", revenue: 1100, orders: 16 },
    { date: "الأربعاء", revenue: 1800, orders: 27 },
    { date: "الخميس",   revenue: 2200, orders: 33 },
    { date: "الجمعة",   revenue: 1950, orders: 28 },
  ],
  weekly: [
    { date: "الأسبوع 1",  revenue: 7200,  orders: 105 },
    { date: "الأسبوع 2",  revenue: 8500,  orders: 124 },
    { date: "الأسبوع 3",  revenue: 9100,  orders: 138 },
    { date: "الأسبوع 4",  revenue: 10450, orders: 152 },
  ],
  monthly: [
    { date: "يناير",    revenue: 28000, orders: 410 },
    { date: "فبراير",   revenue: 32000, orders: 465 },
    { date: "مارس",     revenue: 29500, orders: 430 },
    { date: "أبريل",    revenue: 35000, orders: 510 },
    { date: "مايو",     revenue: 38000, orders: 555 },
    { date: "يونيو",    revenue: 41000, orders: 600 },
  ],
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-border shadow-md p-3 text-sm">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name === "revenue" ? "الإيرادات" : "الطلبات"}:{" "}
          <span className="font-bold text-foreground">
            {p.name === "revenue" ? `SR ${p.value.toLocaleString("ar-SA")}` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data, isLoading } = useSalesData(period);

  const chartData = data?.length ? data : mockData[period];

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">أداء المبيعات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            نمو الإيرادات خلال آخر 7 أيام
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                period === p.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="h-48 bg-muted rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1f8a5b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1f8a5b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Cairo" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Cairo" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#1f8a5b"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "#1f8a5b" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
