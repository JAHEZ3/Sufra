"use client";

import { useTopMeals } from "@/hooks/useRestaurant";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const mockTopMeals = [
  {
    mealId: "1", mealName: "واجو سيجنيتشر برجر", imageUrl: null,
    totalOrders: 56, revenue: 8960, percentageOfTotal: 72,
  },
  {
    mealId: "2", mealName: "كلاسيك ماك باربيكيو", imageUrl: null,
    totalOrders: 34, revenue: 4760, percentageOfTotal: 54,
  },
  {
    mealId: "3", mealName: "جاردن كينوا بول", imageUrl: null,
    totalOrders: 22, revenue: 3300, percentageOfTotal: 35,
  },
];

const colors = ["bg-primary", "bg-success", "bg-info"];

export function TopSellingItems() {
  const { data: meals, isLoading } = useTopMeals();
  const items = meals?.length ? meals : mockTopMeals;

  return (
    <div className="bg-white rounded-xl border border-border h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">أكثر المنتجات مبيعاً</h3>
        <Link href="/dashboard/analytics" className="text-sm text-primary font-semibold hover:underline">
          عرض الكل
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 items-center">
              <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            </div>
          ))
        ) : (
          items.slice(0, 5).map((item, idx) => (
            <div key={item.mealId} className="flex items-center gap-3">
              {/* Image / placeholder */}
              <div className="w-12 h-12 rounded-xl bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {item.imageUrl && /^https?:\/\//i.test(item.imageUrl) ? (
                  <Image src={item.imageUrl} alt={item.mealName} width={48} height={48} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <span className="text-xl">🍔</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground truncate">{item.mealName}</p>
                  <span className="text-xs font-bold text-muted-foreground shrink-0 mr-2">
                    {item.totalOrders} طلب
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colors[idx % colors.length]}`}
                      style={{ width: `${item.percentageOfTotal}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.percentageOfTotal}٪</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 pb-4">
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
        >
          <TrendingUp className="w-4 h-4" />
          عرض تحليلات القائمة
        </Link>
      </div>
    </div>
  );
}
