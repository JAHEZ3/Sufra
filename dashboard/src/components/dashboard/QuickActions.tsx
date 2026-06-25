"use client";

import Link from "next/link";
import { Plus, UtensilsCrossed, BarChart3, Users } from "lucide-react";

const actions = [
  {
    href: "/dashboard/menu",
    icon: <Plus className="w-5 h-5 text-primary" />,
    bg: "bg-primary-light",
    label: "إضافة وجبة",
  },
  {
    href: "/dashboard/menu",
    icon: <UtensilsCrossed className="w-5 h-5 text-success" />,
    bg: "bg-success-light",
    label: "تعديل القائمة",
  },
  {
    href: "/dashboard/analytics",
    icon: <BarChart3 className="w-5 h-5 text-info" />,
    bg: "bg-info-light",
    label: "التقارير",
  },
  {
    href: "/dashboard/settings",
    icon: <Users className="w-5 h-5 text-warning" />,
    bg: "bg-warning-light",
    label: "الموظفين",
  },
];

export function QuickActions() {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h3 className="text-sm font-bold text-foreground mb-3">إجراءات سريعة</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              {a.icon}
            </div>
            <span className="text-[11px] font-semibold text-foreground text-center">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
