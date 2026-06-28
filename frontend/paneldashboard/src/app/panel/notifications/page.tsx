"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell, ShoppingBag, RefreshCw, Truck, CheckCheck, Inbox, Loader2, ChevronLeft, Send,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useMe } from "@/hooks/useAuth";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification.types";

const PAGE_SIZE = 20;

function iconForType(type: string) {
  if (type.startsWith("order.new")) return ShoppingBag;
  if (type.startsWith("order.status")) return RefreshCw;
  if (type.startsWith("order.assigned") || type.includes("delivery")) return Truck;
  return Bell;
}

function colorForType(type: string) {
  if (type.startsWith("order.new")) return { bg: "bg-primary/10", fg: "text-primary" };
  if (type.startsWith("order.status")) return { bg: "bg-info-light", fg: "text-info" };
  if (type.startsWith("order.assigned") || type.includes("delivery")) return { bg: "bg-success-light", fg: "text-success" };
  return { bg: "bg-muted", fg: "text-muted-foreground" };
}

function hrefForNotification(n: AppNotification): string | null {
  const orderId = n.data?.orderId;
  if (typeof orderId === "string" && orderId) return `/panel/orders?id=${orderId}`;
  if (n.type.startsWith("order.")) return "/panel/orders";

  if (n.type.startsWith("restaurant.application")) {
    const rid = n.data?.restaurantId;
    const reqId = n.data?.requestId;
    if (typeof reqId === "string" && reqId) return `/panel/restaurants?requestId=${reqId}`;
    if (typeof rid === "string" && rid) return `/panel/restaurants?id=${rid}`;
    return "/panel/restaurants";
  }

  if (n.type.startsWith("delivery.application")) {
    const aid = n.data?.agentId;
    if (typeof aid === "string" && aid) return `/panel/delivery-agents?id=${aid}`;
    return "/panel/delivery-agents";
  }

  if (n.type.startsWith("restaurant.")) return "/panel/restaurants";

  return null;
}

type Filter = "all" | "unread" | "read";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "unread", label: "غير مقروءة" },
  { value: "read", label: "مقروءة" },
];

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isFetching } = useNotifications(page, PAGE_SIZE);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: me } = useMe();
  const canSend = me?.role === "admin" || me?.role === "manager";

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const unread = data?.unread ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.isRead);
    if (filter === "read") return items.filter((n) => n.isRead);
    return items;
  }, [items, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const day = formatDate(n.createdAt);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(n);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="الإشعارات" subtitle="إشعارات النظام والإشعارات الخاصة بحسابك" />

      <div className="p-6 space-y-5 animate-fade-in-up">
        {/* Title row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("ar-SA")} إجمالي
            {unread > 0 && (
              <>
                {" · "}
                <span className="text-primary font-semibold">{unread} جديد</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {canSend && (
              <Link
                href="/panel/notifications/send"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <Send className="w-4 h-4" />
                إرسال إشعار
              </Link>
            )}
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                تحديد الكل كمقروء
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                filter === f.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {f.value === "unread" && unread > 0 && (
                <span className="mr-2 inline-flex items-center justify-center min-w-4 h-4 px-1 bg-primary text-white text-[9px] rounded-full tabular-nums">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {isLoading && items.length === 0 ? (
            <div className="p-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-base font-bold text-foreground">لا توجد إشعارات</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === "unread"
                  ? "كل إشعاراتك مقروءة."
                  : filter === "read"
                    ? "لا توجد إشعارات مقروءة بعد."
                    : "ستظهر إشعاراتك هنا عند وصولها."}
              </p>
            </div>
          ) : (
            <ul>
              {grouped.map(([day, dayItems]) => (
                <li key={day}>
                  <div className="px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                    {day}
                  </div>
                  <ul className="divide-y divide-border">
                    {dayItems.map((n) => {
                      const Icon = iconForType(n.type);
                      const color = colorForType(n.type);
                      const href = hrefForNotification(n);
                      const Wrapper: React.ElementType = href ? Link : "div";
                      return (
                        <li key={n.id}>
                          <Wrapper
                            {...(href ? { href } : {})}
                            onClick={() => {
                              if (!n.isRead) markRead.mutate(n.id);
                            }}
                            className={cn(
                              "flex gap-4 px-5 py-4 hover:bg-muted/40 transition-colors",
                              !n.isRead && "bg-primary/5",
                              href && "cursor-pointer",
                            )}
                          >
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                color.bg,
                              )}
                            >
                              <Icon className={cn("w-5 h-5", color.fg)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-sm font-bold text-foreground flex-1 min-w-0">
                                  {n.title}
                                </p>
                                {!n.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                )}
                              </div>
                              {n.body && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {n.body}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground mt-1.5">
                                {formatDateTime(n.createdAt)}
                              </p>
                            </div>
                            {href && (
                              <ChevronLeft className="w-4 h-4 text-muted-foreground self-center shrink-0" />
                            )}
                          </Wrapper>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              صفحة {page.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                السابق
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
