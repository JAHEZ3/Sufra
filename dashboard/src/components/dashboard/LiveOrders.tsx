"use client";

import { useEffect } from "react";
import { useOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useSocket } from "@/hooks/useSocket";
import { useQueryClient } from "@tanstack/react-query";
import { OrderStatus } from "@/types/order.types";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { getApiError } from "@/lib/api";
import { Check, X, Clock } from "lucide-react";
import { useToast } from "@/providers/ToastProvider";
import Link from "next/link";

export function LiveOrders() {
  const { data: restaurant } = useRestaurant();
  const { data, isLoading } = useOrders({
    restaurantId: restaurant?.id,
    status: OrderStatus.PENDING,
    limit: 5,
  });
  const updateStatus = useUpdateOrderStatus();
  const { success, error } = useToast();

  // Realtime: react to new orders / status changes pushed from the gateway.
  const { on, connected, registerRestaurant } = useSocket();
  const queryClient = useQueryClient();

  // Join the restaurant room on (re)connect so we get `order:new` broadcasts.
  // Personal-room delivery covers the owner already, but registering is required
  // for managers and survives reconnects without an extra page load.
  useEffect(() => {
    if (connected && restaurant?.id) registerRestaurant(restaurant.id);
  }, [connected, restaurant?.id, registerRestaurant]);

  useEffect(() => {
    const offNew = on("order:new", () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["restaurant", "stats"] });
    });
    const offStatus = on("order:status", () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });
    return () => { offNew(); offStatus(); };
  }, [on, queryClient]);

  const handleAccept = (id: string) => {
    updateStatus.mutate(
      { id, data: { status: OrderStatus.CONFIRMED } },
      {
        onSuccess: () => success("تم قبول الطلب", "سيتم إشعار العميل"),
        onError: (err) => error("خطأ", getApiError(err)),
      }
    );
  };

  const handleReject = (id: string) => {
    updateStatus.mutate(
      { id, data: { status: OrderStatus.CANCELLED } },
      {
        onSuccess: () => success("تم رفض الطلب"),
        onError: (err) => error("خطأ", getApiError(err)),
      }
    );
  };

  const orders = data?.data ?? [];

  return (
    <div className="bg-white rounded-xl border border-border h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">الطلبات المباشرة</h3>
          <span className="w-2 h-2 bg-success rounded-full animate-pulse-dot" />
        </div>
        <Link href="/dashboard/orders" className="text-sm text-primary font-semibold hover:underline">
          عرض الكل
        </Link>
      </div>

      <div className="divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات جديدة حالياً</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {order.customerName[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{order.customerName}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.items[0]?.mealName}
                    {order.items.length > 1 && ` +${order.items.length - 1}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-primary">
                      {formatCurrency(order.totalAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {order.orderNumber} · {formatRelativeTime(order.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {order.status === OrderStatus.PENDING && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="success"
                      className="w-8 h-8 rounded-lg"
                      onClick={() => handleAccept(order.id)}
                      loading={updateStatus.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="danger"
                      className="w-8 h-8 rounded-lg"
                      onClick={() => handleReject(order.id)}
                      loading={updateStatus.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
