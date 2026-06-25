"use client";

import { useRestaurant, useToggleStoreStatus } from "@/hooks/useRestaurant";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/providers/ToastProvider";
import { Store, Wifi, WifiOff, MoreHorizontal } from "lucide-react";

export function StoreStatus() {
  const { data: restaurant, isLoading } = useRestaurant();
  const toggle = useToggleStoreStatus();
  const { success, error } = useToast();

  const isOpen = restaurant?.isOpen ?? false;

  const handleToggle = (checked: boolean) => {
    toggle.mutate(
      { isOpen: checked },
      {
        onSuccess: () =>
          success(checked ? "المطعم مفتوح الآن" : "تم إغلاق المطعم"),
        onError: () => error("خطأ", "فشل تحديث حالة المطعم"),
      }
    );
  };

  return (
    <div
      className="rounded-xl p-4 text-white"
      style={{
        background: isOpen
          ? "linear-gradient(135deg,#1f8a5b,#2fa06d)"
          : "linear-gradient(135deg,#374151,#4B5563)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          <span className="font-bold text-sm">حالة المطعم</span>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <Wifi className="w-5 h-5 text-white/70" />
          ) : (
            <WifiOff className="w-5 h-5 text-white/70" />
          )}
          <button className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <MoreHorizontal className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xl font-black">
          {isLoading ? "..." : isOpen ? "مفتوح للعمل" : "مغلق حالياً"}
        </p>
        <p className="text-sm text-white/70 mt-1">
          {isOpen ? "المطعم يستقبل الطلبات الآن" : "لا يستقبل طلبات حالياً"}
        </p>
      </div>

      <div className="flex items-center justify-between bg-white/15 rounded-xl p-3">
        <span className="text-sm font-semibold">
          {isOpen ? "إغلاق المطعم" : "فتح المطعم"}
        </span>
        <Switch
          checked={isOpen}
          onCheckedChange={handleToggle}
          disabled={isLoading || toggle.isPending}
        />
      </div>
    </div>
  );
}
