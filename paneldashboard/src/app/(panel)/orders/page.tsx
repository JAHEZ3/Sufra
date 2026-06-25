"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, Eye, ShoppingBag,
  Clock, CheckCircle, Bike, XCircle, Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminOrdersApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { formatDateTime, formatCurrency } from "@/lib/utils";

type OrderStatus = "all" | "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  restaurantName: string;
  driverName?: string;
  status: "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  totalAmount: number;
  itemsCount: number;
  city: string;
  createdAt: string;
}

const mockOrders: AdminOrder[] = [
  { id: "1", orderNumber: "ORD-10045", customerName: "فاطمة الزهراني", restaurantName: "مطعم الأصالة",  driverName: "محمد العتيبي", status: "delivered",        totalAmount: 85,  itemsCount: 3, city: "الرياض", createdAt: "2024-07-01T14:30:00" },
  { id: "2", orderNumber: "ORD-10046", customerName: "عبدالله الغامدي", restaurantName: "برجر هاوس",     driverName: "تركي الرشيدي", status: "out_for_delivery", totalAmount: 62,  itemsCount: 2, city: "جدة",    createdAt: "2024-07-01T15:00:00" },
  { id: "3", orderNumber: "ORD-10047", customerName: "منيرة العنزي",   restaurantName: "شاورما نجد",     status: "preparing",        totalAmount: 45,  itemsCount: 1, city: "الرياض", createdAt: "2024-07-01T15:15:00" },
  { id: "4", orderNumber: "ORD-10048", customerName: "نورة الدوسري",   restaurantName: "بيتزا عالم",     status: "pending",           totalAmount: 110, itemsCount: 4, city: "الدمام", createdAt: "2024-07-01T15:20:00" },
  { id: "5", orderNumber: "ORD-10049", customerName: "سارة القحطاني",  restaurantName: "مطعم الأصالة",  status: "cancelled",          totalAmount: 55,  itemsCount: 2, city: "مكة",    createdAt: "2024-07-01T12:00:00" },
  { id: "6", orderNumber: "ORD-10050", customerName: "أحمد الشمري",    restaurantName: "برجر هاوس",     status: "confirmed",          totalAmount: 78,  itemsCount: 3, city: "الرياض", createdAt: "2024-07-01T15:22:00" },
  { id: "7", orderNumber: "ORD-10051", customerName: "ريم الحربي",     restaurantName: "سوشي تايم",     driverName: "سارة القحطاني", status: "delivered",        totalAmount: 145, itemsCount: 5, city: "جدة",    createdAt: "2024-07-01T11:00:00" },
];

const statusConfig: Record<AdminOrder["status"], { label: string; variant: "success" | "warning" | "info" | "error" | "muted" | "default"; icon: React.ReactNode }> = {
  pending:          { label: "بانتظار التأكيد", variant: "warning",  icon: <Clock className="w-3.5 h-3.5" /> },
  confirmed:        { label: "مؤكّد",           variant: "info",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
  preparing:        { label: "قيد التحضير",     variant: "default",  icon: <Package className="w-3.5 h-3.5" /> },
  out_for_delivery: { label: "في الطريق",        variant: "info",     icon: <Bike className="w-3.5 h-3.5" /> },
  delivered:        { label: "مكتمل",            variant: "success",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  cancelled:        { label: "ملغي",             variant: "error",    icon: <XCircle className="w-3.5 h-3.5" /> },
};

const filterLabels: Record<OrderStatus, string> = {
  all:              "الكل",
  pending:          "معلّقة",
  confirmed:        "مؤكّدة",
  preparing:        "قيد التحضير",
  out_for_delivery: "في الطريق",
  delivered:        "مكتملة",
  cancelled:        "ملغاة",
};

export default function OrdersPage() {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<AdminOrder[]>({
    queryKey: queryKeys.orders.all({ status: activeStatus }),
    queryFn: async () => {
      const res = await adminOrdersApi.getAll({
        status: activeStatus === "all" ? undefined : activeStatus,
      });
      return res.data;
    },
    placeholderData: mockOrders,
    retry: false,
  });

  const orders = data ?? mockOrders;

  const filtered = orders.filter((o) => {
    const matchStatus = activeStatus === "all" || o.status === activeStatus;
    const matchSearch =
      !search ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.restaurantName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts: Record<OrderStatus, number> = {
    all:              orders.length,
    pending:          orders.filter((o) => o.status === "pending").length,
    confirmed:        orders.filter((o) => o.status === "confirmed").length,
    preparing:        orders.filter((o) => o.status === "preparing").length,
    out_for_delivery: orders.filter((o) => o.status === "out_for_delivery").length,
    delivered:        orders.filter((o) => o.status === "delivered").length,
    cancelled:        orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="الطلبات" subtitle="عرض وإدارة جميع طلبات المنصة" />

      <div className="p-6 space-y-5 animate-fade-in-up">

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(filterLabels) as OrderStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                activeStatus === s
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {filterLabels[s]}
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
              placeholder="بحث برقم الطلب، العميل، أو المطعم..."
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

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["رقم الطلب", "العميل", "المطعم", "السائق", "المبلغ", "المدينة", "التاريخ", "الحالة", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      لا توجد طلبات تطابق البحث
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => {
                    const cfg = statusConfig[order.status];
                    return (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {order.restaurantName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {order.driverName ?? <span className="text-border">—</span>}
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{order.city}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              عرض {filtered.length} من أصل {orders.length} طلب
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>السابق</Button>
              <Button variant="outline" size="sm">التالي</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
