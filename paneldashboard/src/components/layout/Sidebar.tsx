"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBag,
  Settings,
  LogOut,
  ChevronLeft,
  Shield,
  Bell,
  Truck,
  Tag,
  LifeBuoy,
  Star,
  Mail,
  Globe,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/hooks/useAuth";

const navItems = [
  { href: "/panel/overview",        icon: LayoutDashboard, label: "نظرة عامة"      },
  { href: "/panel/users",           icon: Users,           label: "المستخدمون"     },
  { href: "/panel/restaurants",     icon: Store,           label: "المطاعم"        },
  { href: "/panel/ratings",         icon: Star,            label: "التقييمات"      },
  { href: "/panel/categories",      icon: Tag,             label: "التصنيفات"      },
  { href: "/panel/delivery-agents", icon: Truck,           label: "مندوبو التوصيل" },
  { href: "/panel/orders",          icon: ShoppingBag,     label: "الطلبات"        },
  { href: "/panel/map",             icon: MapIcon,         label: "خريطة المنصة"   },
  { href: "/panel/notifications",   icon: Bell,            label: "الإشعارات"      },
  { href: "/panel/contact",         icon: Mail,            label: "رسائل التواصل"  },
  { href: "/panel/support",         icon: LifeBuoy,        label: "الدعم الفني"    },
  { href: "/panel/website",         icon: Globe,           label: "إدارة الموقع"    },
  { href: "/panel/settings",        icon: Settings,        label: "الإعدادات"      },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <aside
      className="fixed right-0 top-0 h-full flex flex-col bg-white z-40"
      style={{ width: "var(--sidebar-width, 240px)", boxShadow: "-2px 0 16px rgba(0,0,0,0.07)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-20 border-b border-border/60 px-4 py-2">
        <div className="flex items-center p-1 group cursor-pointer">
          <Image
            src="/sufra-mark.png"
            alt="جاهز"
            width={48}
            height={48}
            priority
            unoptimized
            className="object-contain transition-all duration-700 ease-out group-hover:scale-125 group-hover:-rotate-6 group-hover:drop-shadow-[0_8px_20px_rgba(31,138,91,0.55)]"
          />
          <div className="overflow-hidden max-w-0 group-hover:max-w-xs transition-[max-width] duration-700 ease-out">
            <div className="whitespace-nowrap ps-3 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out delay-200">
              <span className="text-2xl font-black text-[#1f8a5b] leading-none block">جاهز</span>
              <span className="text-[10px] text-muted-foreground font-medium leading-none flex items-center gap-0.5 mt-0.5">
                <Shield className="w-2.5 h-2.5" /> لوحة الإدارة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>{label}</span>
              {isActive && <ChevronLeft className="w-4 h-4 text-primary mr-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-border/60">
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-muted-foreground hover:bg-error-light hover:text-error transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
