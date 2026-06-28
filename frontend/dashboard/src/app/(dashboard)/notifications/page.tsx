"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell, ShoppingBag, RefreshCw, Truck, CheckCheck, Inbox, Loader2, ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn, formatRelativeTime, formatDate, formatTime } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationSocket,
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
  if (type.startsWith("order.new")) return { bg: "bg-primary-light", fg: "text-primary" };
  if (type.startsWith("order.status")) return { bg: "bg-info-light", fg: "text-info" };
  if (type.startsWith("order.assigned") || type.includes("delivery")) return { bg: "bg-success-light", fg: "text-success" };
  return { bg: "bg-muted", fg: "text-muted-foreground" };
}

function hrefForNotification(n: AppNotification): string | null {
  const orderId = n.data?.orderId;
  if (typeof orderId === "string" && orderId) return `/orders?id=${orderId}`;
  if (n.type.startsWith("order.")) return "/orders";
  if (n.type === "restaurant.welcome") return "/dashboard";
  if (n.type.startsWith("restaurant.")) return "/settings";
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

  useNotificationSocket();
  const { data, isLoading, isFetching } = useNotifications(page, PAGE_SIZE);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const unread = data?.unread ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.isRead);
    if (filter === "read") return items.filter((n) => n.isRead);
    return items;
  }, [items, filter]);

  // Group by day for friendlier scanning
  const grouped = useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const day = formatDate(n.createdAt, { year: "numeric", month: "long", day: "numeric" });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(n);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-0.5">
              NOTIFICATIONS
            </p>
            <h1 className="text-xl font-black text-foreground">الإشعارات</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString("ar-SA")} إجمالي
              {unread > 0 && (
                <>
                  {" · "}
                  <span className="text-primary font-semibold">{unread} جديد</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                <span>{formatTime(n.createdAt)}</span>
                                <span>·</span>
                                <span>{formatRelativeTime(n.createdAt)}</span>
                              </div>
                            </div>
                            {href && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0 rtl:rotate-180" />
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
