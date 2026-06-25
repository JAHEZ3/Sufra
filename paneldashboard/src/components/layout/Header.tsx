"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: me } = useMe();
  const { data: notifications } = useNotifications(1, 1);
  const unread = notifications?.unread ?? 0;
  const displayName = me?.email?.split("@")[0] ?? "المدير";
  const initial = displayName.charAt(0).toUpperCase() || "A";

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-black text-foreground leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Search className="w-4 h-4" />
        </button>
        <Link
          href="/panel/notifications"
          aria-label="الإشعارات"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
          >
            {initial}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground leading-none">{displayName}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">مدير</p>
          </div>
        </div>
      </div>
    </header>
  );
}
