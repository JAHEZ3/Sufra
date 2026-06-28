"use client";

import Image from "next/image";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRestaurant, useRestaurantFull } from "@/hooks/useRestaurants";
import { formatDateTime } from "@/lib/utils";
import type { RestaurantHour } from "@/types/restaurant-full.types";
import {
  cuisineLabel,
  restaurantStatusBadgeVariant,
  restaurantStatusLabel,
} from "./restaurant-labels";

const DAY_LABELS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

interface RestaurantDetailsDialogProps {
  restaurantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestaurantDetailsDialog({
  restaurantId,
  open,
  onOpenChange,
}: RestaurantDetailsDialogProps) {
  const { data: r, isLoading, isError } = useRestaurant(
    open ? restaurantId ?? undefined : undefined,
  );
  const { data: full } = useRestaurantFull(
    open ? restaurantId ?? undefined : undefined,
  );
  const hours = full?.hours ?? [];
  const rating = Number(r?.rating ?? 0);
  const formattedRating = Number.isFinite(rating) ? rating.toFixed(1) : "0.0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تفاصيل المطعم</DialogTitle>
          <DialogDescription>
            البيانات الكاملة للمطعم مع روابط الصور المصرّح بها.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading || (!r && !isError) ? (
            <div className="space-y-3">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : isError || !r ? (
            <p className="text-sm text-error text-center py-8">
              تعذّر تحميل بيانات المطعم.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Cover + logo */}
              <div className="relative h-36 rounded-xl bg-muted overflow-hidden border border-border">
                {r.coverUrl ? (
                  <Image
                    src={r.coverUrl}
                    alt="Cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    لا توجد صورة غلاف
                  </div>
                )}
                <div className="absolute -bottom-6 right-4 w-16 h-16 rounded-2xl bg-white border border-border shadow-md overflow-hidden">
                  {r.logoUrl ? (
                    <Image
                      src={r.logoUrl}
                      alt="Logo"
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-muted-foreground">
                      شعار
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-base truncate">
                    {r.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {r.id}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant={restaurantStatusBadgeVariant(r.status)}>
                    {restaurantStatusLabel[r.status]}
                  </Badge>
                  <Badge variant={r.isOpen ? "success" : "muted"}>
                    {r.isOpen ? "مفتوح الآن" : "مغلق الآن"}
                  </Badge>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="المالك" value={r.ownerName} />
                <Field label="هاتف المطعم" value={r.phone} dir="ltr" />
                <Field
                  label="المطبخ"
                  value={r.cuisineType ? cuisineLabel[r.cuisineType] : null}
                />
                <Field label="المدينة" value={r.city} />
                <Field label="الشارع" value={r.street} />
                <Field
                  label="الحد الأدنى للطلب"
                  value={`${r.minOrderAmount} شيكل`}
                />
                <Field
                  label="التقييم"
                  value={`${formattedRating} (${r.totalRatings})`}
                />
                <Field label="تاريخ التسجيل" value={formatDateTime(r.createdAt)} />
                <Field
                  label="السجل التجاري"
                  value={r.commercialRegNumber}
                  dir="ltr"
                />
                <Field
                  label="رقم هوية المالك"
                  value={r.ownerNationalIdNumber}
                  dir="ltr"
                />
                <Field
                  label="معرّف حساب المالك"
                  value={r.ownerUserId}
                  dir="ltr"
                />
                {(r.lat != null || r.lng != null) && (
                  <Field
                    label="الموقع"
                    value={
                      r.lat != null && r.lng != null
                        ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`
                        : null
                    }
                    dir="ltr"
                  />
                )}
              </dl>

              {r.lat != null && r.lng != null && (
                <a
                  href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  فتح في خرائط جوجل
                </a>
              )}

              {hours.length > 0 && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    ساعات العمل
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {sortHours(hours).map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-muted-foreground">
                          {DAY_LABELS[h.dayOfWeek] ?? `يوم ${h.dayOfWeek}`}
                        </span>
                        <span className="font-medium text-foreground tabular-nums" dir="ltr">
                          {formatTime(h.openTime)} – {formatTime(h.closeTime)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.description && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground mb-1">الوصف</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {r.description}
                  </p>
                </div>
              )}

              {r.paymentInfo && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    معلومات الدفع
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Field label="البنك" value={r.paymentInfo.bankName} />
                    <Field
                      label="اسم صاحب الحساب"
                      value={r.paymentInfo.accountHolder}
                    />
                    <Field label="الآيبان" value={r.paymentInfo.iban} dir="ltr" />
                  </dl>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  value: string | number | null | undefined;
  dir?: "ltr" | "rtl";
}

function Field({ label, value, dir }: FieldProps) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground mb-0.5">{label}</dt>
      <dd
        className="font-medium text-foreground truncate"
        style={dir ? { direction: dir, textAlign: dir === "ltr" ? "left" : "right" } : undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function sortHours(hours: RestaurantHour[]): RestaurantHour[] {
  return [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function formatTime(t: string): string {
  if (!t) return "—";
  return t.length >= 5 ? t.slice(0, 5) : t;
}
