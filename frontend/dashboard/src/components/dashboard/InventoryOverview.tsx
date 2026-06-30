"use client";

/**
 * مخزون — بطاقة موجزة على اللوحة الرئيسية: قيمة المخزون، الأصناف المنخفضة/النافدة،
 * وقائمة تنبيهات إعادة الطلب. تقرأ من نفس ملخّص المخزون في restaurant-service.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle, TrendingDown, ChevronLeft } from "lucide-react";

type Unit =
  | "kg" | "g" | "l" | "ml" | "piece"
  | "box" | "pack" | "bottle" | "dozen" | "bag";

interface InventoryItem {
  id: string;
  name: string;
  unit: Unit;
  currentQuantity: number | string;
  reorderThreshold: number | string;
}

interface Summary {
  totals: {
    items: number;
    active: number;
    lowStock: number;
    outOfStock: number;
    stockValue: number;
  };
  lowStock: InventoryItem[];
}

const UNIT_LABEL: Record<Unit, string> = {
  kg: "كغ", g: "غ", l: "لتر", ml: "مل", piece: "قطعة",
  box: "صندوق", pack: "عبوة", bottle: "زجاجة", dozen: "دزينة", bag: "كيس",
};

function unwrap<T>(res: { data: unknown }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

const fmtQty = (n: number | string, unit: Unit) =>
  `${Number(n).toLocaleString("ar", { maximumFractionDigits: 3 })} ${UNIT_LABEL[unit] ?? unit}`;

export function InventoryOverview() {
  const { format: sar } = useCurrency();
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["inventory-summary"],
    queryFn: async () => unwrap<Summary>(await inventoryApi.summary()),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  const t = data?.totals;
  const lowStock = data?.lowStock ?? [];

  // No inventory configured yet — nudge the owner to set it up.
  if (!t || t.items === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">المخزون</h2>
          <Link href="/inventory" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            إدارة المخزون <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="py-8 text-center text-muted-foreground">
          <Package className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm">لم تُضِف أصناف مخزون بعد</p>
          <p className="text-xs mt-0.5">أضف المكوّنات لتتبّع الكميات والتنبيهات تلقائياً</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-foreground">المخزون</h2>
        <Link href="/inventory" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          إدارة المخزون <ChevronLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-success/5 p-3">
          <p className="text-[11px] text-muted-foreground font-semibold">قيمة المخزون</p>
          <p className="text-lg font-black text-foreground mt-1">{sar(t.stockValue)}</p>
        </div>
        <div className={`rounded-xl p-3 ${t.lowStock > 0 ? "bg-warning/10" : "bg-muted/40"}`}>
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-warning" /> منخفض
          </p>
          <p className="text-lg font-black text-foreground mt-1">{t.lowStock}</p>
        </div>
        <div className={`rounded-xl p-3 ${t.outOfStock > 0 ? "bg-danger/10" : "bg-muted/40"}`}>
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-danger" /> نفد
          </p>
          <p className="text-lg font-black text-foreground mt-1">{t.outOfStock}</p>
        </div>
      </div>

      {lowStock.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-warning mb-2">أصناف تحتاج إعادة طلب</p>
          <ul className="space-y-2">
            {lowStock.slice(0, 5).map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground truncate">{it.name}</span>
                <span className="text-xs text-warning shrink-0">
                  {fmtQty(it.currentQuantity, it.unit)} / {fmtQty(it.reorderThreshold, it.unit)}
                </span>
              </li>
            ))}
          </ul>
          {lowStock.length > 5 && (
            <p className="text-[11px] text-muted-foreground mt-2">+{lowStock.length - 5} أصناف أخرى</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          كل الأصناف ضمن الحدود الآمنة
        </p>
      )}
    </div>
  );
}
