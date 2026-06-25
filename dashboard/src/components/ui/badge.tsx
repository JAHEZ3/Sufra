import { cn } from "@/lib/utils";
import { LocalOrderStatus, OrderStatus } from "@/types/order.types";

const statusMap: Record<OrderStatus, { label: string; className: string }> = {
  pending:          { label: "قيد الانتظار",     className: "badge-pending"   },
  confirmed:        { label: "مؤكد",              className: "badge-confirmed" },
  preparing:        { label: "يتم التحضير",       className: "badge-preparing" },
  ready_for_pickup: { label: "جاهز للاستلام",     className: "badge-ready"     },
  out_for_delivery: { label: "في الطريق",          className: "badge-confirmed" },
  delivered:        { label: "تم التوصيل",         className: "badge-delivered" },
  cancelled:        { label: "ملغي",               className: "badge-cancelled" },
  refunded:         { label: "مسترد",              className: "badge-cancelled" },
};

const localStatusMap: Record<LocalOrderStatus, { label: string; className: string }> = {
  open:      { label: "مفتوحة",      className: "badge-pending"   },
  preparing: { label: "يتم التحضير", className: "badge-preparing" },
  done:      { label: "تم",          className: "badge-delivered" },
  voided:    { label: "ملغاة",       className: "badge-cancelled" },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, className: "badge-pending" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface LocalOrderStatusBadgeProps {
  status: LocalOrderStatus;
  className?: string;
}

export function LocalOrderStatusBadge({ status, className }: LocalOrderStatusBadgeProps) {
  const config = localStatusMap[status] ?? { label: status, className: "badge-pending" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info" | "outline";
  className?: string;
}

const badgeVariants = {
  default: "bg-primary/10 text-primary",
  success: "bg-success-light text-success",
  error:   "bg-error-light text-error",
  warning: "bg-warning-light text-warning",
  info:    "bg-info-light text-info",
  outline: "border border-border text-foreground",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
