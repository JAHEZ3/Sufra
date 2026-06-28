"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";

function RestaurantAvatar({ logoUrl, fallback }: { logoUrl: string | null; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 group-hover:bg-primary/15 transition-colors">
      {showImage ? (
        // Presigned S3 URL rotates and may be http in dev — plain img is the most robust.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl!}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

export function Header() {
  const { data: restaurant } = useRestaurant();

  return (
    <header className="h-16 bg-white border-b border-border/60 flex items-center px-6 gap-4 sticky top-0 z-30" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="absolute right-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="ابحث عن طلبات، عناصر، أو عملاء..."
            className={cn(
              "w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-muted/40 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-white",
              "transition-all duration-200"
            )}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 mr-auto">
        {/* Notifications */}
        <NotificationsBell />

        {/* Divider */}
        <div className="w-px h-7 bg-border" />

        {/* Restaurant name + avatar */}
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <div className="text-right">
            <p className="text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
              {restaurant?.name ?? "مطعمي"}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">مالك المطعم</p>
          </div>
          <RestaurantAvatar
            key={restaurant?.logoUrl ?? "none"}
            logoUrl={restaurant?.logoUrl ?? null}
            fallback={restaurant?.name?.trim()?.[0] ?? "م"}
          />

        </div>
      </div>
    </header>
  );
}
