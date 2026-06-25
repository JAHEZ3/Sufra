"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Building2,
  Check,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  Map as MapIcon,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  User,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MapboxMap, type MapPin as MapPinData } from "@/components/ui/mapbox-map";
import { useOrderTracking } from "@/hooks/useOrderTracking";
import { adminOrdersApi, type AdminOrderDetails } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabel: Record<AdminOrderDetails["order"]["status"], string> = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكّد",
  preparing: "قيد التحضير",
  ready_for_pickup: "جاهز للاستلام",
  out_for_delivery: "في الطريق",
  delivered: "مكتمل",
  cancelled: "ملغي",
  refunded: "مُسترد",
};

const statusVariant: Record<
  AdminOrderDetails["order"]["status"],
  "success" | "warning" | "info" | "error" | "muted" | "default"
> = {
  pending: "warning",
  confirmed: "info",
  preparing: "default",
  ready_for_pickup: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "error",
  refunded: "muted",
};

const statusIcon: Record<AdminOrderDetails["order"]["status"], React.ReactNode> =
  {
    pending: <Clock className="w-3.5 h-3.5" />,
    confirmed: <CheckCircle className="w-3.5 h-3.5" />,
    preparing: <Package className="w-3.5 h-3.5" />,
    ready_for_pickup: <Package className="w-3.5 h-3.5" />,
    out_for_delivery: <Bike className="w-3.5 h-3.5" />,
    delivered: <CheckCircle className="w-3.5 h-3.5" />,
    cancelled: <XCircle className="w-3.5 h-3.5" />,
    refunded: <XCircle className="w-3.5 h-3.5" />,
  };

const paymentMethodLabel: Record<
  AdminOrderDetails["payment"]["method"],
  string
> = {
  cash_on_delivery: "الدفع عند الاستلام",
  card: "بطاقة",
  online: "دفع إلكتروني",
};

const paymentStatusLabel: Record<
  AdminOrderDetails["payment"]["status"],
  string
> = {
  unpaid: "غير مدفوع",
  paid: "مدفوع",
  refunded: "مُسترد",
};

const paymentStatusVariant: Record<
  AdminOrderDetails["payment"]["status"],
  "success" | "warning" | "muted"
> = {
  paid: "success",
  unpaid: "warning",
  refunded: "muted",
};

const deliveryStatusLabel: Record<string, string> = {
  assigned: "تم التعيين",
  heading_to_restaurant: "متوجّه للمطعم",
  picked_up: "تم الاستلام",
  heading_to_customer: "متوجّه للعميل",
  delivered: "تم التوصيل",
  failed: "فشل",
};

function Row({
  label,
  value,
  emphasize,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span
        className={
          emphasize
            ? "text-sm font-bold text-foreground"
            : "text-xs text-muted-foreground"
        }
      >
        {label}
      </span>
      <span className="text-sm font-medium text-foreground text-left max-w-[60%] break-words">
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-2 text-foreground">
        <span className="w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

export function OrderDetailsDialog({
  orderId,
  open,
  onOpenChange,
}: OrderDetailsDialogProps) {
  const [mapOpen, setMapOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.orders.one(orderId ?? ""),
    queryFn: async () => {
      const res = await adminOrdersApi.getOne(orderId as string);
      return res.data.data;
    },
    enabled: open && !!orderId,
    retry: false,
  });

  const orderNumber = data?.order.orderNumber ?? "—";
  const status = data?.order.status;
  const customerLat = data?.customer.address?.lat;
  const customerLng = data?.customer.address?.lng;
  const hasCustomerCoords =
    typeof customerLat === "number" && typeof customerLng === "number";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>
              تفاصيل الطلب{" "}
              <span className="font-mono text-primary">{orderNumber}</span>
            </DialogTitle>
            {status && (
              <Badge
                variant={statusVariant[status]}
                className="flex items-center gap-1"
              >
                {statusIcon[status]}
                {statusLabel[status]}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          )}

          {isError && !isLoading && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              تعذّر تحميل تفاصيل الطلب.
            </div>
          )}

          {data && !isLoading && (
            <>
              <Section title="الطلب" icon={<ShoppingBag className="w-4 h-4" />}>
                <Row label="رقم الطلب" value={data.order.orderNumber} />
                <Row
                  label="تاريخ الإنشاء"
                  value={formatDateTime(data.order.createdAt)}
                />
                {data.order.estimatedDeliveryAt && (
                  <Row
                    label="موعد التسليم المتوقع"
                    value={formatDateTime(data.order.estimatedDeliveryAt)}
                  />
                )}
                {data.order.deliveredAt && (
                  <Row
                    label="تاريخ التسليم"
                    value={formatDateTime(data.order.deliveredAt)}
                  />
                )}
                {data.order.customerNotes && (
                  <Row label="ملاحظات العميل" value={data.order.customerNotes} />
                )}
              </Section>

              <Section title="العميل" icon={<User className="w-4 h-4" />}>
                <Row label="الاسم" value={data.customer.name || "—"} />
                <Row
                  label="الهاتف"
                  value={
                    data.customer.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span dir="ltr">{data.customer.phone}</span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                {data.customer.address && (
                  <Row
                    label="العنوان"
                    value={
                      <span className="inline-flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                        <span>
                          {[
                            data.customer.address.label,
                            data.customer.address.street,
                            data.customer.address.city,
                          ]
                            .filter(Boolean)
                            .join("، ") || "—"}
                        </span>
                      </span>
                    }
                  />
                )}
                {hasCustomerCoords && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMapOpen(true)}
                      className="gap-1.5"
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      عرض على الخريطة
                    </Button>
                  </div>
                )}
              </Section>

              <Section
                title="المطعم"
                icon={<Building2 className="w-4 h-4" />}
              >
                <Row label="الاسم" value={data.restaurant.name || "—"} />
                {data.restaurant.city && (
                  <Row label="المدينة" value={data.restaurant.city} />
                )}
              </Section>

              <Section title="التوصيل" icon={<Bike className="w-4 h-4" />}>
                {data.delivery ? (
                  <>
                    <Row
                      label="السائق"
                      value={data.delivery.agent?.name ?? "—"}
                    />
                    <Row
                      label="الحالة"
                      value={
                        deliveryStatusLabel[data.delivery.status] ??
                        data.delivery.status
                      }
                    />
                    {data.delivery.distanceKm != null && (
                      <Row
                        label="المسافة"
                        value={`${data.delivery.distanceKm.toFixed(2)} كم`}
                      />
                    )}
                    {data.delivery.agentEarnings != null && (
                      <Row
                        label="عائد السائق"
                        value={formatCurrency(data.delivery.agentEarnings)}
                      />
                    )}
                    {data.delivery.deliveredAt && (
                      <Row
                        label="وقت التسليم"
                        value={formatDateTime(data.delivery.deliveredAt)}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    لم يتم تعيين سائق بعد.
                  </p>
                )}
              </Section>

              <Section
                title="الدفع"
                icon={<CreditCard className="w-4 h-4" />}
              >
                <Row
                  label="الطريقة"
                  value={paymentMethodLabel[data.payment.method]}
                />
                <Row
                  label="حالة الدفع"
                  value={
                    <Badge variant={paymentStatusVariant[data.payment.status]}>
                      {paymentStatusLabel[data.payment.status]}
                    </Badge>
                  }
                />
                {/* Manager toggle — only for online orders. Server validates
                    "paid" requires a proof to be on file. */}
                {data.payment.method === "online" && (
                  <PaymentStatusToggle
                    orderId={data.order.id}
                    current={data.payment.status}
                  />
                )}
                <Row
                  label="المجموع الفرعي"
                  value={formatCurrency(data.payment.subtotal)}
                />
                <Row
                  label="رسوم التوصيل"
                  value={formatCurrency(data.payment.deliveryFee)}
                />
                {data.payment.discountAmount > 0 && (
                  <Row
                    label="الخصم"
                    value={`- ${formatCurrency(data.payment.discountAmount)}`}
                  />
                )}
                <Row
                  emphasize
                  label="الإجمالي"
                  value={
                    <span className="font-black text-primary text-base">
                      {formatCurrency(data.payment.totalAmount)}
                    </span>
                  }
                />
              </Section>

              <Section
                title={`الأصناف (${data.items.length})`}
                icon={<Package className="w-4 h-4" />}
              >
                {data.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    لا توجد أصناف.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 py-2"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} ×{" "}
                            {formatCurrency(item.unitPrice)}
                          </p>
                          {item.specialInstructions && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {item.specialInstructions}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </DialogBody>
      </DialogContent>

      {data && hasCustomerCoords && (
        <OrderLocationDialog
          open={mapOpen}
          onOpenChange={setMapOpen}
          orderId={data.order.id}
          orderNumber={data.order.orderNumber}
          customerName={data.customer.name}
          customerLat={customerLat!}
          customerLng={customerLng!}
          address={[
            data.customer.address?.label,
            data.customer.address?.street,
            data.customer.address?.city,
          ]
            .filter(Boolean)
            .join("، ")}
        />
      )}
    </Dialog>
  );
}

/**
 * Manager-side toggle for an online order's paymentStatus. After eyeballing
 * the customer's uploaded bank-transfer screenshot, the manager flips this
 * from "unpaid" to "paid" (or back, to reverse a mistake). The server
 * rejects "paid" without a proof on file and surfaces a localized message.
 */
function PaymentStatusToggle({
  orderId,
  current,
}: {
  orderId: string;
  current: AdminOrderDetails["payment"]["status"];
}) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const isPaid = current === "paid";

  const mutation = useMutation({
    mutationFn: () =>
      adminOrdersApi.updatePaymentStatus(orderId, {
        paymentStatus: isPaid ? "unpaid" : "paid",
      }),
    onSuccess: () => {
      success(isPaid ? "تم إعادة الحالة إلى غير مدفوع" : "تم تأكيد الدفع");
      qc.invalidateQueries({ queryKey: queryKeys.orders.one(orderId) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
    onError: (e) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "تعذّر تحديث حالة الدفع";
      error("خطأ", msg);
    },
  });

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">إجراء سريع</span>
      <Button
        size="sm"
        variant={isPaid ? "outline" : "default"}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="h-7 text-[11px]"
      >
        {mutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isPaid ? (
          <>
            <X className="w-3.5 h-3.5" /> إعادة إلى غير مدفوع
          </>
        ) : (
          <>
            <Check className="w-3.5 h-3.5" /> وضع علامة مدفوع
          </>
        )}
      </Button>
    </div>
  );
}

function OrderLocationDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  customerLat,
  customerLng,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerLat: number;
  customerLng: number;
  address: string;
}) {
  // Only subscribe to the order room while the dialog is open so we don't
  // hold socket rooms for orders the operator already closed.
  const { driver, connected, isStale } = useOrderTracking(open ? orderId : null);

  const pins: MapPinData[] = [
    {
      id: "dropoff",
      lat: customerLat,
      lng: customerLng,
      label: customerName,
      color: "#16A34A",
      popupHtml: `<div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
        <strong>${escapeHtml(customerName)}</strong>${
          address ? `<br/><span style="color:#666">${escapeHtml(address)}</span>` : ""
        }
      </div>`,
    },
  ];
  if (driver) {
    pins.push({
      id: "driver",
      lat: driver.lat,
      lng: driver.lng,
      label: "السائق",
      color: "#1f8a5b",
      popupHtml: `<div style="font-family: inherit; font-size: 13px;">
        <strong>السائق</strong>
        <br/><span style="color:#666">${
          isStale ? "آخر تحديث منذ أكثر من 15 ثانية" : "آخر تحديث الآن"
        }</span>
      </div>`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            تتبع الطلب{" "}
            <span className="font-mono text-primary">{orderNumber}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-500 animate-pulse" : "bg-gray-300"
                }`}
              />
              <span
                className={
                  connected ? "text-green-600 font-semibold" : "text-muted-foreground"
                }
              >
                {connected ? "اتصال مباشر نشط" : "في انتظار الاتصال…"}
              </span>
            </div>
            <span className="text-muted-foreground">
              {driver
                ? isStale
                  ? "توقفت تحديثات السائق مؤقتاً"
                  : "موقع السائق محدّث"
                : "بانتظار خروج السائق…"}
            </span>
          </div>

          <div className="h-[480px] w-full rounded-xl overflow-hidden border border-border">
            <MapboxMap pins={pins} animate zoom={14} />
          </div>
          {address && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {address}
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
