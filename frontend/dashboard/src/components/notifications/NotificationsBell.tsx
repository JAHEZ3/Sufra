"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell, ShoppingBag, RefreshCw, Truck, CheckCheck, Inbox, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationSocket,
} from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification.types";

function iconForType(type: string) {
  if (type.startsWith("order.new")) return ShoppingBag;
  if (type.startsWith("order.status")) return RefreshCw;
  if (type.startsWith("order.assigned") || type.includes("delivery")) return Truck;
  return Bell;
}

function colorForType(type: string) {
  if (type.startsWith("order.new")) return { bg: "bg-primary-light", fg: "text-primary" };
  if (type.startsWith("order.status")) return { bg: "bg-info-light", fg: "text-info" };
  if (type.startsWith("order.assigned") || type.includes("delivery")) return { bg: "bg-success-light", fg: "text-success" };
  return { bg: "bg-muted", fg: "text-muted-foreground" };
}

function hrefForNotification(n: AppNotification): string {
  const orderId = n.data?.orderId;
  if (typeof orderId === "string" && orderId) return `/orders?id=${orderId}`;
  if (n.type.startsWith("order.")) return "/orders";
  if (n.type === "restaurant.welcome") return "/dashboard";
  if (n.type.startsWith("restaurant.")) return "/settings";
  return "/notifications";
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useNotificationSocket();
  const { data, isLoading } = useNotifications(1, 10);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleItemClick = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="الإشعارات"
        className={cn(
          "relative w-9 h-9 rounded-xl border bg-white flex items-center justify-center transition-all duration-200",
          open
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5",
        )}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-[360px] bg-white rounded-2xl border border-border z-50 animate-fade-in-up overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">الإشعارات</h3>
              {unread > 0 && (
                <span className="text-[10px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full">
                  {unread} جديد
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <div className="p-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Inbox className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">لا توجد إشعارات</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ستظهر هنا عند وصولها
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const Icon = iconForType(n.type);
                  const color = colorForType(n.type);
                  return (
                    <li key={n.id}>
                      <Link
                        href={hrefForNotification(n)}
                        onClick={() => handleItemClick(n)}
                        className={cn(
                          "flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors",
                          !n.isRead && "bg-primary/5",
                        )}
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                            color.bg,
                          )}
                        >
                          <Icon className={cn("w-4 h-4", color.fg)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              عرض جميع الإشعارات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
