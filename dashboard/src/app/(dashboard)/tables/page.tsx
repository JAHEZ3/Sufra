"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";
import { tablesApi, posApi, getApiError } from "@/lib/api";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useToast } from "@/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Download,
  QrCode,
  Maximize2,
  AlertTriangle,
  Eye,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface ActiveOrder {
  id: string;
  orderNumber: string;
  localStatus: "open" | "preparing";
  totalAmount: number;
  subtotal: number;
  paymentStatus: "unpaid" | "paid" | "refunded";
  preparingStartedAt: string | null;
  createdAt: string;
  itemsCount: number;
}

interface RestaurantTable {
  id: string;
  restaurantId: string;
  number: string;
  capacity: number;
  section: string | null;
  qrToken: string;
  isActive: boolean;
  // Server enriches the list response with the currently-active POS bill
  // (OPEN or PREPARING) on this table, if any. Drives the open/closed badge.
  activeOrder?: ActiveOrder | null;
}

const CLIENT_URL = "http:/10.5.50.56:3010";

// Turn a restaurant name into a URL-safe path segment. Keeps Arabic letters
// (browsers display them fine after percent-encoding), drops punctuation,
// collapses whitespace to hyphens. Empty/missing falls back to "r" so the
// route shape is preserved.
function slugify(name: string | null | undefined): string {
  const s = (name ?? "")
    .trim()
    .replace(/[\s/\\?#&%]+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "r";
}

const qrUrl = (token: string, restaurantName: string | null | undefined) =>
  `${CLIENT_URL}/${encodeURIComponent(slugify(restaurantName))}/t/${token}`;

// QRs that embed `localhost`/`127.0.0.1` can't be scanned from a phone —
// the phone resolves it to its own loopback. Flag this so staff know to
// set NEXT_PUBLIC_CLIENT_URL to a LAN IP or a tunnel/production URL.
const isUnscannableHost = /(^https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(
  CLIENT_URL,
);

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

function TableFormDialog({
  initial,
  trigger,
  onSubmit,
  pending,
}: {
  initial?: Partial<RestaurantTable>;
  trigger: React.ReactNode;
  onSubmit: (
    data: {
      number: string;
      capacity: number;
      section?: string;
      isActive: boolean;
    },
    close: () => void,
  ) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(initial?.number ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 4));
  const [section, setSection] = useState(initial?.section ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = () => {
    if (!number.trim()) return;
    onSubmit(
      {
        number: number.trim(),
        capacity: Math.max(1, Number(capacity) || 1),
        section: section.trim() || undefined,
        isActive,
      },
      () => setOpen(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={initial?.id ? "تعديل الطاولة" : "إضافة طاولة"}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">رقم الطاولة</label>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="مثلاً: 5 أو T1"
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">السعة</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">القسم (اختياري)</label>
              <input
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="داخلي / تراس / VIP"
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            نشطة (يمكن للعميل المسح)
          </label>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} loading={pending} className="flex-1">
              {initial?.id ? "حفظ التغييرات" : "إضافة"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TableDetailsDialog({
  table,
  onFinish,
  finishing,
  trigger,
}: {
  table: RestaurantTable;
  onFinish: (orderId: string) => void;
  finishing: boolean;
  trigger: React.ReactNode;
}) {
  const order = table.activeOrder;
  const orderStatusLabel = order
    ? order.localStatus === "open"
      ? "مفتوحة (لم تُقفل)"
      : "يتم التحضير"
    : null;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`تفاصيل الطاولة ${table.number}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">السعة</p>
              <p className="font-bold mt-0.5">{table.capacity} مقعد</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">القسم</p>
              <p className="font-bold mt-0.5">{table.section ?? "—"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold">الطلب الحالي</span>
              {order && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    order.localStatus === "preparing"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-info/10 text-info"
                  }`}
                >
                  {orderStatusLabel}
                </span>
              )}
            </div>
            {!order ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                لا يوجد طلب نشط على هذه الطاولة
              </div>
            ) : (
              <div className="p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم الطلب</span>
                  <span className="font-mono font-bold">
                    {order.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الأصناف</span>
                  <span className="font-bold">{order.itemsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-border">
                  <span>الإجمالي</span>
                  <span className="text-primary">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>الدفع</span>
                  <span>
                    {order.paymentStatus === "paid"
                      ? "مدفوع"
                      : order.paymentStatus === "refunded"
                        ? "مسترد"
                        : "غير مدفوع"}
                  </span>
                </div>

                <div className="flex gap-2 pt-3">
                  {order.localStatus === "preparing" ? (
                    <Button
                      onClick={() => onFinish(order.id)}
                      loading={finishing}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4" /> إنهاء الطلب وتحرير
                      الطاولة
                    </Button>
                  ) : (
                    <Link
                      href="/pos"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90"
                    >
                      <ExternalLink className="w-4 h-4" /> إقفال الفاتورة في
                      نقطة البيع
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({
  table,
  restaurantName,
}: {
  table: RestaurantTable;
  restaurantName: string | null | undefined;
}) {
  const url = qrUrl(table.qrToken, restaurantName);
  const svgRef = useRef<HTMLDivElement>(null);

  const downloadPng = async () => {
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(objUrl);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-table-${table.number}.png`;
      a.click();
    };
    img.src = objUrl;
  };

  // Opens a new tab with just the QR centered on a printable page. Best path
  // for "full-screen" display + printing — sidesteps modal sizing limits.
  const openPrintView = () => {
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR – طاولة ${table.number}</title><style>
      *{box-sizing:border-box} html,body{margin:0;height:100%;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#fff;color:#111}
      main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;text-align:center}
      h1{font-size:48px;margin:0;font-weight:900}
      .sub{font-size:20px;color:#666;margin:0}
      .qr{padding:24px;background:#fff;border:1px solid #eee;border-radius:24px}
      .qr svg{width:min(70vw,70vh);height:min(70vw,70vh)}
      .url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;direction:ltr;color:#666;word-break:break-all;max-width:80%}
      .btn{padding:10px 20px;border:1px solid #ddd;background:#fff;border-radius:12px;font-size:14px;cursor:pointer}
      @media print{.btn{display:none} .url{display:none}}
    </style></head><body><main>
      <h1>طاولة ${table.number}</h1>
      ${table.section ? `<p class="sub">${table.section}</p>` : ""}
      <div class="qr">${svgStr}</div>
      <p class="url">${url}</p>
      <button class="btn" onclick="window.print()">طباعة</button>
    </main></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="w-8 h-8 rounded-lg"
          title="QR"
        >
          <QrCode className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent title={`QR للطاولة ${table.number}`} className="max-w-2xl">
        <div className="flex flex-col items-center gap-4 py-3">
          <div
            ref={svgRef}
            className="p-6 bg-white rounded-xl border border-border"
          >
            <QRCodeSVG value={url} size={384} marginSize={2} level="M" />
          </div>
          <div
            className="text-xs text-muted-foreground text-center break-all"
            dir="ltr"
          >
            {url}
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button onClick={openPrintView} variant="outline">
              <Maximize2 className="w-4 h-4" /> ملء الشاشة / طباعة
            </Button>
            <Button onClick={downloadPng}>
              <Download className="w-4 h-4" /> تحميل PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TablesPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const { data: restaurant } = useRestaurant();

  const { data: tables = [], isLoading } = useQuery<RestaurantTable[]>({
    queryKey: ["tables"],
    queryFn: async () =>
      unwrap<RestaurantTable[]>(await tablesApi.list()) ?? [],
    // Keep occupancy state fresh as POS activity happens on other devices.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tables"] });

  const create = useMutation({
    mutationFn: async (data: {
      number: string;
      capacity: number;
      section?: string;
      isActive: boolean;
    }) => tablesApi.create(data),
    onSuccess: () => {
      invalidate();
      success("تم إنشاء الطاولة");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; data: object }) =>
      tablesApi.update(vars.id, vars.data),
    onSuccess: () => {
      invalidate();
      success("تم تحديث الطاولة");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => tablesApi.remove(id),
    onSuccess: () => {
      invalidate();
      success("تم حذف الطاولة");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const regenerateQr = useMutation({
    mutationFn: async (id: string) => tablesApi.regenerateQr(id),
    onSuccess: () => {
      invalidate();
      success("تم تحديث رمز QR");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  // Marks a PREPARING POS bill as DONE — the table flips back to "متاحة"
  // on the next refetch because the active-order query filters those out.
  const finishOrder = useMutation({
    mutationFn: async (orderId: string) => posApi.finish(orderId),
    onSuccess: () => {
      invalidate();
      success("تم إنهاء الطلب وتحرير الطاولة");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const sorted = useMemo(
    () =>
      [...tables].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    [tables],
  );

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-4">
        {isUnscannableHost && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-xs text-warning-foreground">
              <p className="font-bold text-sm text-warning mb-1">
                رمز QR الحالي لا يعمل على الجوال
              </p>
              <p>
                الرابط داخل QR هو{" "}
                <span dir="ltr" className="font-mono">
                  {CLIENT_URL}
                </span>{" "}
                — «localhost» يعني الجهاز نفسه. لتشغيل المسح من جوال العميل،
                عيّن المتغيّر{" "}
                <span dir="ltr" className="font-mono">
                  NEXT_PUBLIC_CLIENT_URL
                </span>{" "}
                إلى عنوان IP لشبكتك المحلية (مثال:{" "}
                <span dir="ltr" className="font-mono">
                  http://192.168.1.10:3000
                </span>
                ) أو إلى رابط الإنتاج، ثم أعد تشغيل الـ dashboard.
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground">
              إدارة الطاولات
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              أنشئ طاولات للمطعم وأنشئ لكل طاولة رمز QR للطلب الذاتي
            </p>
          </div>
          <TableFormDialog
            pending={create.isPending}
            trigger={
              <Button>
                <Plus className="w-4 h-4" /> إضافة طاولة
              </Button>
            }
            onSubmit={(data, close) =>
              create.mutate(data, { onSuccess: () => close() })
            }
          />
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full mr-auto" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <QrCode className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">لا توجد طاولات بعد</p>
              <p className="text-xs mt-1">
                ابدأ بإضافة طاولة لتوليد رمز QR لها
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    الرقم
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    السعة
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    القسم
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    الحالة
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    الطلب الحالي
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((t) => {
                  const order = t.activeOrder;
                  const isBusy = !!order;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-sm">
                        {t.number}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {t.capacity}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {t.section ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded w-fit ${
                              isBusy
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-success/10 text-success"
                            }`}
                          >
                            {isBusy ? "مفتوحة" : "متاحة"}
                          </span>
                          {!t.isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit bg-muted text-muted-foreground">
                              QR متوقف
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {order ? (
                          <div className="space-y-0.5">
                            <p className="font-mono font-bold text-xs">
                              {order.orderNumber}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {order.itemsCount} صنف ·{" "}
                              {formatCurrency(order.totalAmount)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <TableDetailsDialog
                            table={t}
                            finishing={finishOrder.isPending}
                            onFinish={(orderId) => finishOrder.mutate(orderId)}
                            trigger={
                              <Button
                                size="icon"
                                variant="outline"
                                className="w-8 h-8 rounded-lg"
                                title="تفاصيل"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                          {order?.localStatus === "preparing" && (
                            <Button
                              size="icon"
                              variant="success"
                              className="w-8 h-8 rounded-lg"
                              title="إنهاء الطلب"
                              onClick={async () => {
                                if (
                                  await confirmDialog(
                                    `إنهاء طلب الطاولة ${t.number} وتحريرها؟`,
                                  )
                                ) {
                                  finishOrder.mutate(order.id);
                                }
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <QrDialog
                            table={t}
                            restaurantName={restaurant?.name}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8 rounded-lg"
                            title="إعادة توليد QR"
                            onClick={async () => {
                              if (
                                await confirmDialog(
                                  "سيتم إبطال رمز QR الحالي. هل تريد المتابعة؟",
                                )
                              ) {
                                regenerateQr.mutate(t.id);
                              }
                            }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <TableFormDialog
                            initial={t}
                            pending={update.isPending}
                            trigger={
                              <Button
                                size="icon"
                                variant="outline"
                                className="w-8 h-8 rounded-lg"
                                title="تعديل"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            }
                            onSubmit={(data, close) =>
                              update.mutate(
                                { id: t.id, data },
                                { onSuccess: () => close() },
                              )
                            }
                          />
                          <Button
                            size="icon"
                            variant="danger"
                            className="w-8 h-8 rounded-lg"
                            title="حذف"
                            onClick={async () => {
                              if (await confirmDialog(`حذف الطاولة ${t.number}؟`)) {
                                remove.mutate(t.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
