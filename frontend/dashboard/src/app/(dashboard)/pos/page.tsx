"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useMenu } from "@/hooks/useMenu";
import { posApi, tablesApi, getApiError } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/providers/ToastProvider";
import { successChime, scannerBeep } from "@/lib/sounds";
import { formatCurrency } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  Printer,
  X,
} from "lucide-react";
import type { Meal } from "@/types/menu.types";

type ServiceType = "dine_in" | "takeaway";
type PaymentMethod = "cash_on_delivery" | "card" | "online";

interface PosOrderItem {
  id: string;
  mealId: string;
  mealNameSnapshot: string;
  unitPriceSnapshot: number | string;
  quantity: number;
  totalPrice: number | string;
}

type LocalStatus = "pending" | "open" | "preparing" | "done" | "voided";

interface PaymentSplit {
  id?: string;
  amount: number | string;
  method: string;
  paidAt: string;
  reference?: string | null;
  payerName?: string | null;
}

interface PosOrder {
  id: string;
  orderNumber: string;
  serviceType: ServiceType;
  tableNumber: string | null;
  localStatus: LocalStatus;
  subtotal: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  paymentSplits: PaymentSplit[] | null;
  items: PosOrderItem[];
  preparingStartedAt: string | null;
}

interface RestaurantTable {
  id: string;
  number: string;
  capacity: number;
  section: string | null;
  isActive: boolean;
}

// 15 minutes — must match PREPARING_AUTO_DONE_MS on the server.
const PREPARING_AUTO_DONE_MS = 15 * 60 * 1000;

// Open a styled invoice in a new window and auto-trigger the browser print
// dialog. The new window owns its own CSS so print formatting doesn't depend
// on the dashboard's stylesheet. The window self-closes after printing.
function printInvoice(
  order: PosOrder,
  restaurant: { name?: string | null; logoUrl?: string | null } | undefined,
  opts: { autoPrint?: boolean } = {},
) {
  const restaurantName = restaurant?.name ?? "المطعم";
  const logoTag = restaurant?.logoUrl
    ? `<img src="${restaurant.logoUrl}" alt="${restaurantName}" class="logo">`
    : "";
  const now = new Date();
  const stamp = now.toLocaleString("ar");
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discountAmount);
  const total = Number(order.totalAmount);
  const fmt = (n: number) =>
    new Intl.NumberFormat("ar", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 2,
    }).format(n);
  const serviceLabel =
    order.serviceType === "dine_in"
      ? `صالة · طاولة ${order.tableNumber ?? "—"}`
      : "استلام";

  const itemsHtml = order.items
    .map(
      (it) => `
        <tr>
          <td class="name">${it.mealNameSnapshot}</td>
          <td class="qty">× ${it.quantity}</td>
          <td class="price">${fmt(Number(it.totalPrice))}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
  <title>فاتورة ${order.orderNumber}</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,'Noto Naskh Arabic',sans-serif}
    .wrap{max-width:380px;margin:0 auto;padding:18px}
    header{text-align:center;border-bottom:2px dashed #999;padding-bottom:12px;margin-bottom:12px}
    .logo{width:72px;height:72px;border-radius:12px;object-fit:cover;margin:0 auto 6px}
    h1{margin:0;font-size:20px;font-weight:900}
    .sub{margin:4px 0 0;font-size:12px;color:#666}
    .meta{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;margin:8px 0}
    .meta .k{color:#666}
    .meta .v{font-weight:700;text-align:left;direction:ltr}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
    th,td{padding:6px 4px;text-align:right;border-bottom:1px dotted #ccc}
    th{font-size:11px;color:#666;font-weight:700}
    td.qty{text-align:center;width:60px;color:#666}
    td.price{text-align:left;width:90px;direction:ltr;font-weight:700}
    .totals{margin-top:12px;font-size:13px}
    .totals .row{display:flex;justify-content:space-between;padding:3px 0}
    .totals .grand{margin-top:6px;padding-top:8px;border-top:2px solid #111;font-size:16px;font-weight:900}
    footer{margin-top:16px;text-align:center;font-size:11px;color:#666;border-top:1px dashed #999;padding-top:10px}
    .controls{margin:14px 0;display:flex;gap:8px;justify-content:center}
    button{padding:8px 16px;border:1px solid #ccc;background:#fff;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit}
    @media print{.controls{display:none} .wrap{max-width:none}}
  </style></head><body><div class="wrap">
    <header>
      ${logoTag}
      <h1>${restaurantName}</h1>
      <p class="sub">${serviceLabel}</p>
    </header>
    <div class="meta">
      <div class="k">رقم الطلب</div><div class="v">${order.orderNumber}</div>
      <div class="k">التاريخ</div><div class="v">${stamp}</div>
    </div>
    <table>
      <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>المجموع الفرعي</span><span>${fmt(subtotal)}</span></div>
      ${discount > 0 ? `<div class="row" style="color:#c33"><span>خصم</span><span>- ${fmt(discount)}</span></div>` : ""}
      <div class="row grand"><span>الإجمالي</span><span>${fmt(total)}</span></div>
    </div>
    <footer>شكراً لزيارتكم</footer>
    <div class="controls"><button onclick="window.print()">طباعة</button></div>
  </div>
  <script>${opts.autoPrint ? "window.addEventListener('load',()=>setTimeout(()=>window.print(),300));window.addEventListener('afterprint',()=>window.close());" : ""}</script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

export default function PosPage() {
  const { data: restaurant } = useRestaurant();
  const { data: menus, isLoading: menuLoading } = useMenu();
  const { success, error } = useToast();
  const qc = useQueryClient();

  const [serviceType, setServiceType] = useState<ServiceType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");
  // Service-type filter for the open-orders list in the left aside.
  // "all" = both kinds, "dine_in" = صالة only, "takeaway" = استلام only.
  const [serviceFilter, setServiceFilter] = useState<"all" | ServiceType>(
    "all",
  );
  // Online-payment metadata captured at close time. Only sent when method === "online".
  const [onlineRef, setOnlineRef] = useState("");
  const [onlinePayer, setOnlinePayer] = useState("");
  const [onlinePaidAt, setOnlinePaidAt] = useState("");
  // Per-split edit buffer keyed by split id. null = not editing this row.
  const [editingSplit, setEditingSplit] = useState<
    Record<
      string,
      { reference: string; payerName: string; paidAt: string } | undefined
    >
  >({});
  // Re-render every second so preparing-countdowns tick down live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatRemaining = (preparingStartedAt: string | null): string => {
    if (!preparingStartedAt) return "";
    const ends =
      new Date(preparingStartedAt).getTime() + PREPARING_AUTO_DONE_MS;
    const remaining = Math.max(0, ends - now);
    const m = Math.floor(remaining / 60_000);
    const s = Math.floor((remaining % 60_000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Flat list of available meals across all menus/sections
  const meals = useMemo<Meal[]>(() => {
    const out: Meal[] = [];
    for (const m of menus ?? []) {
      for (const s of m.sections ?? []) {
        for (const meal of s.meals ?? []) {
          if (meal.isAvailable) out.push(meal);
        }
      }
    }
    return out;
  }, [menus]);

  const filteredMeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter((m) => m.name.toLowerCase().includes(q));
  }, [meals, search]);

  // Open POS orders (left column lets staff resume any open bill)
  const { data: openOrders } = useQuery<PosOrder[]>({
    queryKey: ["pos", "open", restaurant?.id],
    queryFn: async () =>
      unwrap<PosOrder[]>(await posApi.listOpen(restaurant!.id)) ?? [],
    enabled: !!restaurant?.id,
    refetchInterval: 10_000,
  });

  // Registered dine-in tables — drives the cashier's visual table picker.
  const { data: tables } = useQuery<RestaurantTable[]>({
    queryKey: ["pos", "tables", restaurant?.id],
    queryFn: async () => unwrap<RestaurantTable[]>(await tablesApi.list()) ?? [],
    enabled: !!restaurant?.id,
    refetchInterval: 30_000,
  });
  const activeTables = useMemo(
    () =>
      (tables ?? [])
        .filter((t) => t.isActive)
        .sort((a, b) =>
          a.number.localeCompare(b.number, undefined, { numeric: true }),
        ),
    [tables],
  );
  // Map a table number → its current open bill (first match wins; a table
  // should only ever have one active POS order). Includes PENDING/OPEN/PREPARING.
  const orderByTable = useMemo(() => {
    const map = new Map<string, PosOrder>();
    for (const o of openOrders ?? []) {
      if (o.serviceType === "dine_in" && o.tableNumber && !map.has(o.tableNumber)) {
        map.set(o.tableNumber, o);
      }
    }
    return map;
  }, [openOrders]);

  // Active order detail
  const activeOrder = useMemo(
    () => openOrders?.find((o) => o.id === activeOrderId) ?? null,
    [openOrders, activeOrderId],
  );
  // When the active bill has been closed, the panel becomes read-only until
  // the 15-min timer flips it to DONE (and the row disappears from listOpen).
  const isActivePreparing = activeOrder?.localStatus === "preparing";

  const refreshOrders = () =>
    qc.invalidateQueries({ queryKey: ["pos", "open", restaurant?.id] });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createOrder = useMutation({
    mutationFn: async (firstItem: {
      mealId: string;
      mealName: string;
      basePrice: number;
    }) => {
      const res = await posApi.create({
        restaurantId: restaurant!.id,
        restaurantName: restaurant!.name,
        serviceType,
        tableNumber: serviceType === "dine_in" ? tableNumber || null : null,
        customerName: customerName || undefined,
        items: [{ ...firstItem, quantity: 1 }],
      });
      return unwrap<PosOrder>(res);
    },
    onSuccess: (order) => {
      scannerBeep(); // first item scanned → checkout beep
      setActiveOrderId(order.id);
      refreshOrders();
      success("فتح طلب جديد", order.orderNumber);
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const addItem = useMutation({
    mutationFn: async ({ orderId, meal }: { orderId: string; meal: Meal }) => {
      const res = await posApi.addItem(orderId, {
        mealId: meal.id,
        mealName: meal.name,
        basePrice: Number(meal.basePrice),
        quantity: 1,
      });
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => { scannerBeep(); refreshOrders(); }, // item scanned → beep
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const updateItem = useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      quantity,
    }: {
      orderId: string;
      itemId: string;
      quantity: number;
    }) => {
      const res = await posApi.updateItem(orderId, itemId, { quantity });
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => refreshOrders(),
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const removeItem = useMutation({
    mutationFn: async ({
      orderId,
      itemId,
    }: {
      orderId: string;
      itemId: string;
    }) => {
      const res = await posApi.removeItem(orderId, itemId);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => refreshOrders(),
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const setDiscount = useMutation({
    mutationFn: async ({
      orderId,
      amount,
    }: {
      orderId: string;
      amount: number;
    }) => {
      const res = await posApi.setDiscount(orderId, amount);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      setDiscountInput("");
      success("تم تطبيق الخصم");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const close = useMutation({
    mutationFn: async ({
      orderId,
      method,
      reference,
      payerName,
      paidAt,
    }: {
      orderId: string;
      method: PaymentMethod;
      reference?: string;
      payerName?: string;
      paidAt?: string;
    }) => {
      const res = await posApi.close(orderId, {
        paymentMethod: method,
        ...(reference !== undefined ? { reference } : {}),
        ...(payerName !== undefined ? { payerName } : {}),
        ...(paidAt !== undefined ? { paidAt } : {}),
      });
      return unwrap<PosOrder>(res);
    },
    onSuccess: (order) => {
      successChime(); // payment success — Apple-Pay-style chime
      refreshOrders();
      setOnlineRef("");
      setOnlinePayer("");
      setOnlinePaidAt("");
      // Fires the kitchen-invoice print as soon as the bill transitions to
      // PREPARING — the "dynamic event" trigger. Browsers gate auto-print
      // behind a user gesture; this works because the click on "إقفال
      // الفاتورة" is the gesture that owns this callback.
      if (order)
        printInvoice(order, restaurant ?? undefined, { autoPrint: true });
      setActiveOrderId(null);
      success("تم إقفال الطلب", "تمت الفوترة بنجاح");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const reopen = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await posApi.reopen(orderId);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      success("تم إعادة فتح الطلب", "يمكنك الآن تعديل الأصناف");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const finish = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await posApi.finish(orderId);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      setActiveOrderId(null);
      success("تم إنهاء الطلب");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  // Accept / reject for PENDING bills submitted via customer QR scan.
  // Accept flips to PREPARING (kitchen starts + timer); reject voids.
  const acceptOrder = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await posApi.accept(orderId);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      success("تم قبول الطلب", "بدأ التحضير");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const rejectOrder = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }) => {
      const res = await posApi.reject(orderId, reason);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      setActiveOrderId(null);
      success("تم رفض الطلب");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const voidOrder = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await posApi.void(orderId);
      return unwrap<PosOrder>(res);
    },
    onSuccess: () => {
      refreshOrders();
      setActiveOrderId(null);
      success("تم إلغاء الطلب");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  // Manually trigger ESC/POS print over LAN. Useful for reprints — the
  // close() flow already fires this once automatically.
  const thermalPrint = useMutation({
    mutationFn: async ({
      orderId,
      target,
    }: {
      orderId: string;
      target: "kitchen" | "cashier" | "both";
    }) => posApi.print(orderId, target),
    onSuccess: () => success("تم إرسال الطلب للطابعة"),
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const updatePayment = useMutation({
    mutationFn: async (vars: {
      orderId: string;
      splitId: string;
      reference?: string;
      payerName?: string;
      paidAt?: string;
    }) => {
      const { orderId, splitId, ...data } = vars;
      const res = await posApi.updatePayment(orderId, splitId, data);
      return unwrap<PosOrder>(res);
    },
    onSuccess: (_d, vars) => {
      refreshOrders();
      setEditingSplit((s) => ({ ...s, [vars.splitId]: undefined }));
      success("تم تحديث الدفعة");
    },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  // ── Click on a meal: create order if none, else add to active ────────────
  const onMealClick = (meal: Meal) => {
    if (!restaurant) return;
    if (serviceType === "dine_in" && !activeOrderId && !tableNumber.trim()) {
      error("خطأ", "أدخل رقم الطاولة أولاً");
      return;
    }
    if (activeOrderId) {
      addItem.mutate({ orderId: activeOrderId, meal });
    } else {
      createOrder.mutate({
        mealId: meal.id,
        mealName: meal.name,
        basePrice: Number(meal.basePrice),
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* ── Left: open bills + setup ─────────────────────────────────────── */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-bold">طلب جديد</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setServiceType("dine_in")}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                  serviceType === "dine_in"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground border-border"
                }`}
              >
                صالة
              </button>
              <button
                type="button"
                onClick={() => setServiceType("takeaway")}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                  serviceType === "takeaway"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground border-border"
                }`}
              >
                استلام
              </button>
            </div>
            {serviceType === "dine_in" && (
              <div className="space-y-2">
                {activeTables.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        الطاولات
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          مشغولة
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          بانتظار
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                      {activeTables.map((t) => {
                        const ord = orderByTable.get(t.number);
                        const pending = ord?.localStatus === "pending";
                        const occupied = !!ord;
                        const selected = tableNumber === t.number;
                        const tone = pending
                          ? "bg-amber-50 border-amber-300 text-amber-700"
                          : occupied
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-white border-border text-foreground hover:border-primary/40";
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setTableNumber(t.number);
                              setActiveOrderId(ord ? ord.id : null);
                            }}
                            title={
                              occupied
                                ? `طاولة ${t.number} · ${ord!.orderNumber}`
                                : `طاولة ${t.number} · متاحة`
                            }
                            className={`relative py-2 rounded-lg text-xs font-bold border transition-colors flex flex-col items-center justify-center gap-0.5 ${tone} ${
                              selected ? "ring-2 ring-primary" : ""
                            }`}
                          >
                            <span>{t.number}</span>
                            {occupied && (
                              <span className="text-[9px] font-semibold leading-none tabular-nums">
                                {formatCurrency(Number(ord!.totalAmount))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <input
                  value={tableNumber}
                  onChange={(e) => {
                    setTableNumber(e.target.value);
                    setActiveOrderId(null);
                  }}
                  placeholder={
                    activeTables.length > 0
                      ? "أو أدخل رقماً يدوياً"
                      : "رقم الطاولة"
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            )}
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل (اختياري)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              اضغط على أي صنف لفتح طلب جديد.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold">الطلبات المفتوحة</h3>
              <span className="text-[11px] text-muted-foreground">
                {
                  (openOrders ?? []).filter((o) =>
                    serviceFilter === "all"
                      ? true
                      : o.serviceType === serviceFilter,
                  ).length
                }
              </span>
            </div>
            <div className="px-2 pt-2 flex gap-1">
              {[
                { v: "all" as const, label: "الكل" },
                { v: "dine_in" as const, label: "صالة" },
                { v: "takeaway" as const, label: "استلام" },
              ].map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => setServiceFilter(f.v)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    serviceFilter === f.v
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {(openOrders ?? []).filter((o) =>
                serviceFilter === "all"
                  ? true
                  : o.serviceType === serviceFilter,
              ).length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                  لا توجد طلبات مفتوحة
                </li>
              ) : (
                (openOrders ?? [])
                  .filter((o) =>
                    serviceFilter === "all"
                      ? true
                      : o.serviceType === serviceFilter,
                  )
                  .map((o) => {
                    const isPreparing = o.localStatus === "preparing";
                    const isPending = o.localStatus === "pending";
                    return (
                      <li
                        key={o.id}
                        className={`relative ${activeOrderId === o.id ? "bg-primary/5" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveOrderId(o.id)}
                          className={`w-full text-right px-4 py-3 hover:bg-muted/40 ${
                            isPreparing ? "opacity-90" : ""
                          } ${isPending ? "pb-12" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold truncate">
                              {o.serviceType === "dine_in"
                                ? `طاولة ${o.tableNumber ?? "—"}`
                                : "استلام"}
                            </span>
                            <span className="text-xs font-bold text-primary">
                              {formatCurrency(Number(o.totalAmount))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[11px] text-muted-foreground">
                              {o.orderNumber} · {o.items?.length ?? 0} صنف
                            </p>
                            {isPreparing && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                يتم التحضير ·{" "}
                                {formatRemaining(o.preparingStartedAt)}
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                في انتظار القبول
                              </span>
                            )}
                          </div>
                        </button>
                        {/* PENDING rows get inline Accept/Reject icons under the row. Sits
                          outside the parent <button> to keep HTML valid. */}
                        {isPending && (
                          <div className="absolute left-4 right-4 bottom-2 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptOrder.mutate({ orderId: o.id });
                              }}
                              disabled={acceptOrder.isPending}
                              className="flex-1 py-1 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[11px] font-bold hover:bg-emerald-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                              {acceptOrder.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              قبول
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (await confirmDialog("رفض هذا الطلب؟")) {
                                  rejectOrder.mutate({ orderId: o.id });
                                }
                              }}
                              disabled={rejectOrder.isPending}
                              className="flex-1 py-1 rounded-lg border border-danger/40 bg-white text-danger text-[11px] font-bold hover:bg-danger/5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                              {rejectOrder.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              رفض
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })
              )}
            </ul>
          </div>
        </aside>

        {/* ── Middle: meals grid ───────────────────────────────────────────── */}
        <section className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-border h-full flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صنف..."
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <div className="p-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2 overflow-y-auto flex-1">
              {menuLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))
              ) : filteredMeals.length === 0 ? (
                <div className="col-span-full text-center text-xs text-muted-foreground py-12">
                  لا توجد أصناف متاحة
                </div>
              ) : (
                filteredMeals.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => onMealClick(meal)}
                    disabled={createOrder.isPending || addItem.isPending}
                    className="text-right rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50 overflow-hidden flex flex-col"
                  >
                    {/* AI-generated meal image (or placeholder) — square thumb at the top. */}
                    <div className="aspect-square w-full bg-muted/40 flex items-center justify-center overflow-hidden">
                      {meal.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={meal.imageUrl}
                          alt={meal.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-2xl opacity-50">🍽️</span>
                      )}
                    </div>
                    <div className="p-1.5">
                      <div className="text-xs font-bold truncate leading-tight">
                        {meal.name}
                      </div>
                      <div className="text-[11px] text-primary font-semibold mt-0.5">
                        {formatCurrency(Number(meal.basePrice))}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Right: cart / bill ───────────────────────────────────────────── */}
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-border h-full flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold flex-1">الفاتورة</h3>
              {activeOrder && (
                <>
                  <span className="text-[11px] text-muted-foreground">
                    {activeOrder.orderNumber}
                  </span>
                  {/* Close the panel only — deselects the bill without finishing
                      it. The order stays open in the list. */}
                  <button
                    type="button"
                    onClick={() => setActiveOrderId(null)}
                    title="إغلاق النافذة (دون إنهاء الطلب)"
                    aria-label="إغلاق النافذة"
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {!activeOrder ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
                <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold">لم يتم فتح طلب</p>
                <p className="text-xs text-muted-foreground mt-1">
                  اضغط على صنف لفتح طلب جديد، أو اختر طلباً مفتوحاً.
                </p>
              </div>
            ) : (
              <>
                {isActivePreparing && (
                  <div className="mx-4 mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 text-center">
                    يتم التحضير · ينتهي بعد{" "}
                    {formatRemaining(activeOrder.preparingStartedAt)}
                  </div>
                )}
                <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto flex-1">
                  {activeOrder.items.map((it) => (
                    <li
                      key={it.id}
                      className="px-4 py-3 flex items-start gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {it.mealNameSnapshot}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatCurrency(Number(it.unitPriceSnapshot))} ×{" "}
                          {it.quantity}
                        </p>
                      </div>
                      {/* Items stay editable in PREPARING — cashier can add / remove until close. */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem.mutate({
                              orderId: activeOrder.id,
                              itemId: it.id,
                              quantity: it.quantity - 1,
                            })
                          }
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center tabular-nums">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateItem.mutate({
                              orderId: activeOrder.id,
                              itemId: it.id,
                              quantity: it.quantity + 1,
                            })
                          }
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem.mutate({
                              orderId: activeOrder.id,
                              itemId: it.id,
                            })
                          }
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-danger/10 text-danger"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border p-4 space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>المجموع الفرعي</span>
                    <span>{formatCurrency(Number(activeOrder.subtotal))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="خصم"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-border rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const amt = Number(discountInput);
                        if (!Number.isFinite(amt) || amt < 0) return;
                        setDiscount.mutate({
                          orderId: activeOrder.id,
                          amount: amt,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
                    >
                      تطبيق
                    </button>
                  </div>
                  {Number(activeOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-danger">
                      <span>الخصم</span>
                      <span>
                        - {formatCurrency(Number(activeOrder.discountAmount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-border">
                    <span>الإجمالي</span>
                    <span className="text-primary">
                      {formatCurrency(Number(activeOrder.totalAmount))}
                    </span>
                  </div>

                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const m = e.target.value as PaymentMethod;
                      setPaymentMethod(m);
                      if (m !== "online") {
                        setOnlineRef("");
                        setOnlinePayer("");
                        setOnlinePaidAt("");
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="cash_on_delivery">نقدي</option>
                    <option value="card">بطاقة</option>
                    <option value="online">إلكتروني</option>
                  </select>
                  {paymentMethod === "online" && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                      <input
                        type="text"
                        value={onlineRef}
                        onChange={(e) => setOnlineRef(e.target.value)}
                        placeholder="رقم العملية"
                        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={onlinePayer}
                        onChange={(e) => setOnlinePayer(e.target.value)}
                        placeholder="اسم الدافع"
                        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs"
                      />
                      <input
                        type="datetime-local"
                        value={onlinePaidAt}
                        onChange={(e) => setOnlinePaidAt(e.target.value)}
                        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {(activeOrder.paymentSplits?.length ?? 0) > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-[11px] font-bold text-muted-foreground">
                        الدفعات
                      </p>
                      <ul className="space-y-2">
                        {activeOrder.paymentSplits!.map((sp, idx) => {
                          const splitId = sp.id;
                          const editable =
                            !!splitId &&
                            (activeOrder.localStatus === "open" ||
                              activeOrder.localStatus === "preparing");
                          const buf = splitId
                            ? editingSplit[splitId]
                            : undefined;
                          const isEditing = !!buf;
                          return (
                            <li
                              key={splitId ?? idx}
                              className="rounded-lg border border-border p-2 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">
                                  {sp.method === "online"
                                    ? "إلكتروني"
                                    : sp.method === "card"
                                      ? "بطاقة"
                                      : "نقدي"}{" "}
                                  · {formatCurrency(Number(sp.amount))}
                                </span>
                                {editable && !isEditing && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingSplit((s) => ({
                                        ...s,
                                        [splitId!]: {
                                          reference: sp.reference ?? "",
                                          payerName: sp.payerName ?? "",
                                          paidAt: sp.paidAt
                                            ? new Date(sp.paidAt)
                                                .toISOString()
                                                .slice(0, 16)
                                            : "",
                                        },
                                      }))
                                    }
                                    className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                    aria-label="تعديل"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {!isEditing ? (
                                <div className="text-muted-foreground space-y-0.5">
                                  {sp.reference && (
                                    <div>رقم العملية: {sp.reference}</div>
                                  )}
                                  {sp.payerName && (
                                    <div>الدافع: {sp.payerName}</div>
                                  )}
                                  <div>
                                    {new Date(sp.paidAt).toLocaleString("ar")}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={buf!.reference}
                                    onChange={(e) =>
                                      setEditingSplit((s) => ({
                                        ...s,
                                        [splitId!]: {
                                          ...buf!,
                                          reference: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="رقم العملية"
                                    className="w-full px-2 py-1 border border-border rounded text-[11px]"
                                  />
                                  <input
                                    type="text"
                                    value={buf!.payerName}
                                    onChange={(e) =>
                                      setEditingSplit((s) => ({
                                        ...s,
                                        [splitId!]: {
                                          ...buf!,
                                          payerName: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="اسم الدافع"
                                    className="w-full px-2 py-1 border border-border rounded text-[11px]"
                                  />
                                  <input
                                    type="datetime-local"
                                    value={buf!.paidAt}
                                    onChange={(e) =>
                                      setEditingSplit((s) => ({
                                        ...s,
                                        [splitId!]: {
                                          ...buf!,
                                          paidAt: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-border rounded text-[11px]"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updatePayment.mutate({
                                          orderId: activeOrder.id,
                                          splitId: splitId!,
                                          reference:
                                            buf!.reference || undefined,
                                          payerName:
                                            buf!.payerName || undefined,
                                          paidAt: buf!.paidAt
                                            ? new Date(
                                                buf!.paidAt,
                                              ).toISOString()
                                            : undefined,
                                        })
                                      }
                                      disabled={updatePayment.isPending}
                                      className="flex-1 py-1 rounded border border-primary text-primary text-[11px] font-semibold hover:bg-primary/5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> حفظ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSplit((s) => ({
                                          ...s,
                                          [splitId!]: undefined,
                                        }))
                                      }
                                      className="flex-1 py-1 rounded border border-border text-[11px] font-semibold hover:bg-muted"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Action stack. Branches on lifecycle state:
                      PENDING  → Accept (→ PREPARING) / Reject (→ VOIDED)
                      PREPARING → close (→ DONE) + print + void
                  */}
                  <div className="space-y-2">
                    {activeOrder.localStatus === "pending" ? (
                      <>
                        <div className="w-full py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs text-center">
                          طلب من العميل · في انتظار قبولك
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            acceptOrder.mutate({ orderId: activeOrder.id })
                          }
                          disabled={acceptOrder.isPending}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {acceptOrder.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          قبول الطلب · بدء التحضير
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              await confirmDialog("رفض هذا الطلب؟ سيتم إلغاؤه نهائياً.")
                            ) {
                              rejectOrder.mutate({ orderId: activeOrder.id });
                            }
                          }}
                          disabled={rejectOrder.isPending}
                          className="w-full py-2 rounded-xl border border-danger/40 bg-white text-danger font-bold text-xs hover:bg-danger/5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                        >
                          {rejectOrder.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          رفض الطلب
                        </button>
                      </>
                    ) : (
                      <>
                        {isActivePreparing && (
                          <div className="w-full py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs text-center">
                            يتم التحضير · ينتهي بعد{" "}
                            {formatRemaining(activeOrder.preparingStartedAt)}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            close.mutate({
                              orderId: activeOrder.id,
                              method: paymentMethod,
                              reference:
                                paymentMethod === "online"
                                  ? onlineRef || undefined
                                  : undefined,
                              payerName:
                                paymentMethod === "online"
                                  ? onlinePayer || undefined
                                  : undefined,
                              paidAt:
                                paymentMethod === "online" && onlinePaidAt
                                  ? new Date(onlinePaidAt).toISOString()
                                  : undefined,
                            })
                          }
                          disabled={
                            close.isPending || activeOrder.items.length === 0
                          }
                          className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {close.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : null}
                          إقفال الفاتورة (إنهاء)
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              printInvoice(activeOrder, restaurant ?? undefined)
                            }
                            disabled={activeOrder.items.length === 0}
                            className="py-2 rounded-xl border border-border bg-white text-foreground font-bold text-xs hover:bg-muted/40 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            طباعة (متصفح)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              thermalPrint.mutate({
                                orderId: activeOrder.id,
                                target: "both",
                              })
                            }
                            disabled={
                              activeOrder.items.length === 0 ||
                              thermalPrint.isPending
                            }
                            className="py-2 rounded-xl border border-border bg-white text-foreground font-bold text-xs hover:bg-muted/40 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                          >
                            {thermalPrint.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
                            طابعة حرارية
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirmDialog("هل أنت متأكد من إلغاء الطلب؟")) {
                              voidOrder.mutate({ orderId: activeOrder.id });
                            }
                          }}
                          disabled={voidOrder.isPending}
                          className="w-full py-2 rounded-xl border border-danger/40 bg-white text-danger font-bold text-xs hover:bg-danger/5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                        >
                          {voidOrder.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          إلغاء الطلب
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
