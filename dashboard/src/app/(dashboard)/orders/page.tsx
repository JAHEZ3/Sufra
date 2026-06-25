"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import {
  useOrders,
  useUpdateOrderStatus,
  useUpdatePaymentStatus,
  useVoidPosOrder,
  useFinishPosOrder,
} from "@/hooks/useOrders";
import { useRestaurant } from "@/hooks/useRestaurant";
import {
  OrderStatus,
  Order,
  PaymentMethod,
  PaymentStatus,
  LocalServiceType,
  LocalOrderStatus,
} from "@/types/order.types";
import { LocalOrderStatusBadge, OrderStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MapboxMap, type MapPin } from "@/components/ui/mapbox-map";
import { useOrderTracking } from "@/hooks/useOrderTracking";
import { formatCurrency, formatTime, formatRelativeTime } from "@/lib/utils";
import {
  Check,
  X,
  Eye,
  ChevronRight,
  ChevronLeft,
  Search,
  RefreshCw,
  MessageSquare,
  Send,
  Loader2,
  WifiOff,
  Lock,
  FileText,
  Download,
  ExternalLink,
  AlertCircle,
  Trash2,
  Utensils,
  ShoppingBag,
  Bike,
  Clock,
  Map as MapIcon,
  MapPin as MapPinIcon,
  Receipt,
  ImageOff,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/providers/ToastProvider";
import { useSocket } from "@/hooks/useSocket";
import { useQueryClient } from "@tanstack/react-query";
import { ordersApi, getApiError } from "@/lib/api";
import { downloadOrdersExcel } from "@/lib/exportOrders";
import { normalizeOrder } from "@/types/order.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  content: string;
  createdAt: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusFilters = [
  { value: "all", label: "جميع الطلبات" },
  { value: OrderStatus.PENDING, label: "قيد الانتظار" },
  { value: OrderStatus.CONFIRMED, label: "مؤكد" },
  { value: OrderStatus.PREPARING, label: "يتم التحضير" },
  { value: OrderStatus.READY_FOR_PICKUP, label: "جاهز للاستلام" },
  { value: OrderStatus.DELIVERED, label: "تم التوصيل" },
  { value: OrderStatus.CANCELLED, label: "ملغي" },
];

// Friendly Arabic labels for the status-edit dropdown.
const orderStatusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "قيد الانتظار",
  [OrderStatus.CONFIRMED]: "مؤكد",
  [OrderStatus.PREPARING]: "يتم التحضير",
  [OrderStatus.READY_FOR_PICKUP]: "جاهز للاستلام",
  [OrderStatus.OUT_FOR_DELIVERY]: "في الطريق",
  [OrderStatus.DELIVERED]: "تم التوصيل",
  [OrderStatus.CANCELLED]: "ملغي",
  [OrderStatus.REFUNDED]: "مسترد",
};

// Restaurant-owner allowed next states from each status (must mirror
// ALLOWED_TRANSITIONS in apps/order-service/src/order/order.service.ts).
const nextStatusOptions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.CANCELLED,
  ],
};

// Must match ONLINE_PREPARING_AUTO_READY_MS on the server.
const ONLINE_PREPARING_AUTO_READY_MS = 15 * 60 * 1000;

// Local POS bills have their own short lifecycle, not the delivery flow.
const localStatusFilters = [
  { value: "all", label: "كل الفواتير" },
  { value: "open", label: "مفتوحة" },
  { value: "preparing", label: "يتم التحضير" },
  { value: "done", label: "تم" },
  { value: "voided", label: "ملغاة" },
];

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash_on_delivery: "الدفع عند الاستلام",
  card: "بطاقة",
  online: "أونلاين",
};

// ─── Chat panel ───────────────────────────────────────────────────────────────

const senderRoleLabel: Record<string, string> = {
  customer: "العميل",
  restaurant: "المطعم",
  delivery: "السائق",
  manager: "الإدارة",
};

const senderInitial = (name: string, role: string) => {
  const trimmed = name?.trim() || senderRoleLabel[role] || "";
  return trimmed[0] ?? "؟";
};

const senderTone = (role: string): { bg: string; text: string } => {
  switch (role) {
    case "restaurant":
      return { bg: "bg-primary", text: "text-white" };
    case "delivery":
      return { bg: "bg-info", text: "text-white" };
    case "manager":
      return { bg: "bg-warning", text: "text-white" };
    default:
      return { bg: "bg-muted", text: "text-foreground" };
  }
};

const isSameMinute = (a: string, b: string) =>
  new Date(a).getTime() - new Date(b).getTime() < 60_000;

function ChatPanel({
  orderId,
  isLocked,
}: {
  orderId: string;
  isLocked?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { on, joinOrder, leaveOrder, connected } = useSocket();
  const { error } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    joinOrder(orderId);
    ordersApi
      .getChat(orderId)
      .then((res) => {
        if (!cancelled) setMessages(res.data?.data ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const off = on("chat:message", (...args: unknown[]) => {
      const raw = args[0] as (ChatMsg & { messageId?: string }) | undefined;
      if (!raw || raw.orderId !== orderId) return;
      // Order-service emits `messageId` over the socket but `id` over HTTP.
      const msg: ChatMsg = { ...raw, id: raw.id ?? raw.messageId ?? "" };
      if (!msg.id) return;
      setMessages((prev) =>
        prev.some((p) => p.id === msg.id) ? prev : [...prev, msg],
      );
    });

    return () => {
      cancelled = true;
      off();
      leaveOrder(orderId);
    };
  }, [orderId, joinOrder, leaveOrder, on]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Auto-grow the textarea up to ~5 lines.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || isLocked) return;
    setSending(true);
    try {
      await ordersApi.sendChat(orderId, body);
      setText("");
    } catch (e) {
      error("تعذر إرسال الرسالة", getApiError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-96 border border-border rounded-xl overflow-hidden mt-4 bg-white">
      {/* Header */}
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">
            محادثة الطلب
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {connected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>متصل</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>غير متصل</span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-muted/10">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل المحادثة…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">لا توجد رسائل بعد</p>
            <p className="text-[10px] mt-0.5 opacity-70">
              ابدأ المحادثة مع العميل
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped =
              prev &&
              prev.senderId === m.senderId &&
              isSameMinute(prev.createdAt, m.createdAt);
            const mine = m.senderRole === "restaurant";
            const tone = senderTone(m.senderRole);

            return (
              <div
                key={m.id}
                className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${grouped ? "mt-0.5" : "mt-2"}`}
              >
                {/* Avatar */}
                <div className="w-7 shrink-0 flex justify-center">
                  {!grouped && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${tone.bg} ${tone.text}`}
                      title={senderRoleLabel[m.senderRole] ?? m.senderRole}
                    >
                      {senderInitial(m.senderName, m.senderRole)}
                    </div>
                  )}
                </div>

                {/* Bubble + meta */}
                <div
                  className={`flex flex-col max-w-[75%] ${mine ? "items-end" : "items-start"}`}
                >
                  {!grouped && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-foreground">
                        {m.senderName || senderRoleLabel[m.senderRole]}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {senderRoleLabel[m.senderRole]}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
                      mine
                        ? "bg-primary text-white rounded-tr-md"
                        : "bg-white border border-border rounded-tl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-white">
        {isLocked ? (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            المحادثة مغلقة — الطلب منتهٍ
          </div>
        ) : (
          <div className="p-2 flex items-end gap-2">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب رسالة... (Enter للإرسال، Shift+Enter لسطر جديد)"
              className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 max-h-[120px]"
            />
            <Button
              size="icon"
              onClick={send}
              loading={sending}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-xl shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat dialog ──────────────────────────────────────────────────────────────

function ChatDialog({
  order,
  children,
}: {
  order: Order;
  children: React.ReactNode;
}) {
  const isLocked =
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUNDED;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={`محادثة الطلب ${order.orderNumber}`}
        description={`${order.customerName} · ${order.customerPhone}`}
        className="max-w-2xl"
      >
        <ChatPanel orderId={order.id} isLocked={isLocked} />
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice panel ────────────────────────────────────────────────────────────

function InvoicePanel({ order }: { order: Order }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const fetchUrl = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await ordersApi.getReceipt(order.id);
      const body = res.data as Record<string, unknown>;
      // Handle: { data: { url } } | { url } | bare string
      const inner = body?.data;
      const receiptUrl =
        (inner && typeof inner === "object" && typeof (inner as Record<string, unknown>).url === "string"
          ? (inner as Record<string, unknown>).url
          : null) ??
        (typeof body?.url === "string" ? body.url : null) ??
        (typeof inner === "string" ? inner : null) ??
        null;
      if (receiptUrl) {
        setUrl(receiptUrl as string);
      } else {
        setUrl(null);
        setErrMsg(
          (typeof body?.message === "string" ? body.message : null) ??
            "الفاتورة لم تُنشأ بعد",
        );
      }
    } catch (e) {
      setErrMsg(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    if (order.receiptKey) fetchUrl();
    // Re-run only when the receipt key actually changes (e.g. receipt finished after async job).
  }, [order.receiptKey, fetchUrl]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">
            الفاتورة الإلكترونية
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchUrl}
            loading={loading}
            className="h-7 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" /> تحديث
          </Button>
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> فتح
              </a>
              <a
                href={url}
                download={`invoice-${order.orderNumber}.html`}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3 h-3" /> تحميل
              </a>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        {loading ? (
          <div className="h-64 flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الفاتورة…
          </div>
        ) : errMsg ? (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
            <AlertCircle className="w-6 h-6 opacity-50" />
            <p className="text-xs text-center">{errMsg}</p>
          </div>
        ) : url ? (
          <iframe
            src={url}
            title={`Invoice ${order.orderNumber}`}
            className="w-full h-96 bg-white"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="w-6 h-6 opacity-40" />
            <p className="text-xs">لا توجد فاتورة متاحة</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment proof panel ──────────────────────────────────────────────────────
// Shows the receipt image the customer uploaded at checkout. The order has
// `paymentProofKey` once uploaded; the backend returns a presigned URL on demand.

function PaymentProofPanel({ order }: { order: Order }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const updatePayment = useUpdatePaymentStatus();
  const { success, error } = useToast();

  const isPaid = order.paymentStatus === PaymentStatus.PAID;
  const isOnline = order.paymentMethod === PaymentMethod.ONLINE;
  const hasProofKey = !!order.paymentProofKey;

  const togglePayment = useCallback(() => {
    const next: "paid" | "unpaid" = isPaid ? "unpaid" : "paid";
    if (next === "paid" && isOnline && !hasProofKey) {
      error("تعذّر تأكيد الدفع", "العميل لم يرفع إيصال الدفع بعد.");
      return;
    }
    updatePayment.mutate(
      { id: order.id, paymentStatus: next },
      {
        onSuccess: () =>
          success(
            next === "paid"
              ? "تم تأكيد الدفع"
              : "تم إعادة الحالة إلى غير مدفوع",
          ),
        onError: (e) => error("تعذّر تحديث حالة الدفع", getApiError(e)),
      },
    );
  }, [isPaid, isOnline, hasProofKey, updatePayment, order.id, success, error]);

  const fetchUrl = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await ordersApi.getPaymentProof(order.id);
      const body = res.data as Record<string, unknown>;
      // Handle: { data: { url } } | { url } | bare string
      const inner = body?.data;
      const proofUrl =
        (inner && typeof inner === "object" && typeof (inner as Record<string, unknown>).url === "string"
          ? (inner as Record<string, unknown>).url
          : null) ??
        (typeof body?.url === "string" ? body.url : null) ??
        (typeof inner === "string" ? inner : null) ??
        null;
      if (proofUrl) {
        setUrl(proofUrl as string);
      } else {
        setUrl(null);
        setErrMsg(
          (typeof body?.message === "string" ? body.message : null) ??
            "لم يرفع العميل إيصال الدفع بعد",
        );
      }
    } catch (e) {
      setErrMsg(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    if (order.paymentProofKey) fetchUrl();
    else {
      setUrl(null);
      setErrMsg(null);
    }
  }, [order.paymentProofKey, fetchUrl]);

  const hasProof = !!order.paymentProofKey;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">
            إيصال الدفع من العميل
          </span>
          {/* Real paymentStatus badge — not derived from hasProof, so the
              restaurant's "Mark as paid" decision is what's actually shown. */}
          {isPaid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success">
              <Check className="w-2.5 h-2.5" /> مدفوع
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning">
              غير مدفوع
            </span>
          )}
          {hasProof && !isPaid && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-info/10 text-info">
              بانتظار التأكيد
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Toggle the order between paid ↔ unpaid. Visible for online orders
              regardless of proof state — server-side validation blocks
              "paid" without a proof and surfaces the localized error. */}
          {isOnline && (
            <Button
              size="sm"
              variant={isPaid ? "outline" : "default"}
              onClick={togglePayment}
              loading={updatePayment.isPending}
              className="h-7 text-[11px]"
            >
              {isPaid ? (
                <>
                  <X className="w-3 h-3" /> إعادة إلى غير مدفوع
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" /> وضع علامة مدفوع
                </>
              )}
            </Button>
          )}
          {hasProof && (
            <Button
              size="sm"
              variant="outline"
              onClick={fetchUrl}
              loading={loading}
              className="h-7 text-[11px]"
            >
              <RefreshCw className="w-3 h-3" /> تحديث
            </Button>
          )}
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> فتح
              </a>
              <a
                href={url}
                download={`payment-proof-${order.orderNumber}.jpg`}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3 h-3" /> تحميل
              </a>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        {loading ? (
          <div className="h-64 flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الإيصال…
          </div>
        ) : !hasProof ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
            <ImageOff className="w-7 h-7 opacity-40" />
            <p className="text-xs text-center font-semibold">
              لم يرفع العميل إيصال الدفع بعد
            </p>
            <p className="text-[10px] text-center opacity-70">
              الطلب يعتبر غير مدفوع حتى يرفع العميل الإيصال
            </p>
          </div>
        ) : errMsg ? (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
            <AlertCircle className="w-6 h-6 opacity-50" />
            <p className="text-xs text-center">{errMsg}</p>
          </div>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Payment proof ${order.orderNumber}`}
              className="w-full max-h-[480px] object-contain bg-muted/30"
            />
          </a>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Receipt className="w-6 h-6 opacity-40" />
            <p className="text-xs">لا يوجد إيصال متاح</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Order type cell ──────────────────────────────────────────────────────────
// Local POS orders carry a service type (dine-in / takeaway) and an optional
// table number. Online orders are always delivery.

function OrderTypeCell({
  order,
  kind,
}: {
  order: Order;
  kind: "online" | "local";
}) {
  if (kind === "local") {
    if (order.serviceType === LocalServiceType.DINE_IN) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-info/10 text-info text-xs font-bold">
          <Utensils className="w-3.5 h-3.5" />
          <span>طاولة {order.tableNumber ?? "—"}</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 text-warning text-xs font-bold">
        <ShoppingBag className="w-3.5 h-3.5" />
        <span>سفري</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
      <Bike className="w-3.5 h-3.5" />
      <span>توصيل</span>
    </div>
  );
}

// ─── Order detail dialog ──────────────────────────────────────────────────────

const posPaymentMethodLabel: Record<string, string> = {
  cash: "نقدًا",
  card: "بطاقة",
  online: "أونلاين",
  wallet: "محفظة",
};

const posPaymentMethodTone: Record<string, string> = {
  cash: "bg-success/10 text-success",
  card: "bg-info/10 text-info",
  online: "bg-primary/10 text-primary",
  wallet: "bg-warning/10 text-warning",
};

function PosPaymentSummary({ order }: { order: Order }) {
  const splits = order.paymentSplits ?? [];
  const paid = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const due = Math.max(order.totalAmount - paid, 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground">الدفع</span>
      </div>
      <div className="p-4 space-y-2 text-sm">
        {splits.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            لم يُسجَّل دفع بعد
          </p>
        ) : (
          splits.map((s, i) => {
            const isCash = s.method === "cash";
            const tone =
              posPaymentMethodTone[s.method] ?? "bg-muted text-foreground";
            const label = posPaymentMethodLabel[s.method] ?? s.method;
            return (
              <div
                key={s.id ?? i}
                className="bg-muted/30 rounded-lg px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${tone}`}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(s.paidAt)}
                    </span>
                  </div>
                  <span className="font-bold">{formatCurrency(s.amount)}</span>
                </div>
                {!isCash && (s.payerName || s.reference) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {s.payerName && (
                      <span>
                        المُحوِّل:{" "}
                        <span className="text-foreground font-medium">
                          {s.payerName}
                        </span>
                      </span>
                    )}
                    {s.reference && (
                      <span>
                        المرجع:{" "}
                        <span className="text-foreground font-medium" dir="ltr">
                          {s.reference}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div className="flex justify-between border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground">المدفوع</span>
          <span className="font-bold text-success">{formatCurrency(paid)}</span>
        </div>
        {due > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">المتبقي</span>
            <span className="font-bold text-warning">
              {formatCurrency(due)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderDetailDialog({
  order,
  kind,
}: {
  order: Order;
  kind: "online" | "local";
}) {
  const isLocal = kind === "local";
  const updateStatus = useUpdateOrderStatus();
  const { success, error } = useToast();
  const [mapOpen, setMapOpen] = useState(false);

  const addr = order.deliveryAddress;
  const hasCoords =
    !!addr && typeof addr.lat === "number" && typeof addr.lng === "number";
  const addressText = addr
    ? [addr.label, addr.street, addr.city].filter(Boolean).join("، ")
    : "";

  const nextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
    [OrderStatus.PENDING]: OrderStatus.CONFIRMED,
    [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
    [OrderStatus.PREPARING]: OrderStatus.READY_FOR_PICKUP,
    [OrderStatus.READY_FOR_PICKUP]: OrderStatus.OUT_FOR_DELIVERY,
    [OrderStatus.OUT_FOR_DELIVERY]: OrderStatus.DELIVERED,
  };
  const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
    [OrderStatus.PENDING]: "قبول الطلب",
    [OrderStatus.CONFIRMED]: "بدء التحضير",
    [OrderStatus.PREPARING]: "جاهز للاستلام",
    [OrderStatus.READY_FOR_PICKUP]: "خرج للتوصيل",
    [OrderStatus.OUT_FOR_DELIVERY]: "تم التوصيل",
  };

  const next = !isLocal ? nextStatusMap[order.status] : undefined;
  const nextLabel = !isLocal ? nextStatusLabel[order.status] : undefined;

  return (
    <DialogContent title={`تفاصيل الطلب ${order.orderNumber}`} className="max-w-3xl">
      <div className="space-y-6 max-h-[100vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">الحالة</span>
          {isLocal ? (
            <LocalOrderStatusBadge
              status={order.localStatus ?? LocalOrderStatus.OPEN}
            />
          ) : (
            <OrderStatusBadge status={order.status} />
          )}
        </div>

        {isLocal && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">النوع</span>
            <OrderTypeCell order={order} kind="local" />
          </div>
        )}

        {/* For local POS bills there's often no real customer record — skip the
            customer card if both name and phone are blank. */}
        {(!isLocal || order.customerName || order.customerPhone) && (
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h4 className="text-sm font-bold">بيانات العميل</h4>
            {order.customerName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الاسم</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الهاتف</span>
                <span className="font-medium" dir="ltr">
                  {order.customerPhone}
                </span>
              </div>
            )}
            {order.customerNotes && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ملاحظات</span>
                <span className="font-medium text-yellow-600">
                  {order.customerNotes}
                </span>
              </div>
            )}
            {!isLocal && addressText && (
              <div className="flex justify-between text-sm items-start">
                <span className="text-muted-foreground">العنوان</span>
                <span className="font-medium text-left flex-1 mr-2">
                  {addressText}
                </span>
              </div>
            )}
            {!isLocal && hasCoords && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMapOpen(true)}
                className="w-full mt-2"
              >
                <MapIcon className="w-4 h-4" />
                عرض الموقع على الخريطة
              </Button>
            )}
          </div>
        )}

        {!isLocal && hasCoords && (
          <OrderTrackingDialog
            open={mapOpen}
            onOpenChange={setMapOpen}
            orderId={order.id}
            orderNumber={order.orderNumber}
            customerName={order.customerName}
            dropoffLat={addr!.lat!}
            dropoffLng={addr!.lng!}
            addressText={addressText}
          />
        )}

        <div>
          <h4 className="text-sm font-bold mb-2">الوجبات</h4>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2"
              >
                <span>{item.mealName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    × {item.quantity}
                  </span>
                  <span className="font-bold">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">المجموع الفرعي</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {!isLocal && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم التوصيل</span>
              <span>{formatCurrency(order.deliveryFee)}</span>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>خصم</span>
              <span>- {formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>الإجمالي</span>
            <span className="text-primary">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
          {!isLocal && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>طريقة الدفع</span>
              <span>{paymentMethodLabel[order.paymentMethod]}</span>
            </div>
          )}
        </div>

        {isLocal ? (
          <PosPaymentSummary order={order} />
        ) : (
          order.paymentMethod === PaymentMethod.ONLINE && (
            <>
              <PaymentProofPanel order={order} />
              <InvoicePanel order={order} />
            </>
          )
        )}

        {!isLocal && next && nextLabel && (
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() =>
                updateStatus.mutate(
                  { id: order.id, data: { status: next } },
                  {
                    onSuccess: () => success("تم تحديث الطلب"),
                    onError: (e) => error("خطأ", getApiError(e)),
                  },
                )
              }
              loading={updateStatus.isPending}
            >
              <Check className="w-4 h-4" /> {nextLabel}
            </Button>
            {order.status === OrderStatus.PENDING && (
              <Button
                variant="danger"
                onClick={() =>
                  updateStatus.mutate(
                    { id: order.id, data: { status: OrderStatus.CANCELLED } },
                    {
                      onSuccess: () => success("تم رفض الطلب"),
                      onError: (e) => error("خطأ", getApiError(e)),
                    },
                  )
                }
                loading={updateStatus.isPending}
              >
                <X className="w-4 h-4" /> رفض
              </Button>
            )}
          </div>
        )}

        {!isLocal && (
          <ChatDialog order={order}>
            <Button variant="outline" size="sm" className="w-full">
              <MessageSquare className="w-4 h-4" />
              فتح المحادثة
            </Button>
          </ChatDialog>
        )}
      </div>
    </DialogContent>
  );
}

// ─── Status cell with edit dropdown + live PREPARING countdown ────────────────
// Only used for online orders — POS bills use the POS page UI.

function StatusCell({
  order,
  onChange,
  pending,
}: {
  order: Order;
  onChange: (next: OrderStatus) => void;
  pending: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (order.status !== OrderStatus.PREPARING || !order.preparingStartedAt)
      return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order.status, order.preparingStartedAt]);

  const remaining = (() => {
    if (order.status !== OrderStatus.PREPARING || !order.preparingStartedAt)
      return null;
    const ends =
      new Date(order.preparingStartedAt).getTime() +
      ONLINE_PREPARING_AUTO_READY_MS;
    const ms = Math.max(0, ends - now);
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  })();

  const options = nextStatusOptions[order.status] ?? [];

  return (
    <div className="space-y-1.5">
      <OrderStatusBadge status={order.status} />
      {remaining && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"
          suppressHydrationWarning
        >
          <Clock className="w-3 h-3" /> {remaining}
        </div>
      )}
      {options.length > 0 && (
        <select
          value=""
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value as OrderStatus | "";
            if (v) onChange(v);
            e.currentTarget.value = "";
          }}
          className="block w-full text-[11px] px-2 py-1 rounded-lg border border-border bg-white disabled:opacity-50"
        >
          <option value="">تغيير الحالة…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Sufra is POS-only — electronic/delivery orders were removed.
  const [kindFilter] = useState<"online" | "local">("local");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const { on, connected, registerRestaurant } = useSocket();

  const { data: restaurant } = useRestaurant();

  // Join the restaurant socket room on (re)connect.
  useEffect(() => {
    if (connected && restaurant?.id) registerRestaurant(restaurant.id);
  }, [connected, restaurant?.id, registerRestaurant]);

  // Real-time: refresh the list when orders change. The global <OrderAlerts>
  // (dashboard layout) owns the bell + toast — we only invalidate here so we
  // never show a second notification for the same event.
  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    const offNew = on("order:new", invalidate);
    const offStatus = on("order:status", invalidate);
    return () => {
      offNew();
      offStatus();
    };
  }, [on, queryClient]);

  const { data, isLoading, refetch, isFetching } = useOrders({
    restaurantId: restaurant?.id,
    kind: kindFilter,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 10,
  });

  const updateStatus = useUpdateOrderStatus();
  const voidPos = useVoidPosOrder();
  const finishPos = useFinishPosOrder();
  const [exporting, setExporting] = useState(false);

  const orders: Order[] = data?.data ?? [];
  const total = data?.total ?? orders.length;

  // Export *all* orders (not just the current page) to an Excel file. Pulls the
  // full list in one large-limit request, honoring the active status filter.
  const handleExport = useCallback(async () => {
    if (!restaurant?.id) return;
    setExporting(true);
    try {
      const res = await ordersApi.getAll({
        restaurantId: restaurant.id,
        kind: kindFilter,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page: 1,
        limit: 10000,
      });
      const body = res.data as { data?: { data?: unknown[] } } | undefined;
      const rows = Array.isArray(body?.data?.data) ? body!.data!.data! : [];
      const all = rows.map((r) =>
        normalizeOrder(r as Parameters<typeof normalizeOrder>[0]),
      );
      if (all.length === 0) {
        error("لا توجد طلبات للتصدير");
        return;
      }
      downloadOrdersExcel(all);
      success(`تم تصدير ${all.length} طلب إلى Excel`);
    } catch (e) {
      error("تعذر تصدير الطلبات", getApiError(e));
    } finally {
      setExporting(false);
    }
  }, [restaurant?.id, kindFilter, statusFilter, success, error]);

  const filtered = search
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          o.customerName?.toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground">
              إدارة الطلبات
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} طلب</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              loading={exporting}
              disabled={!restaurant?.id}
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
            >
              <RefreshCw className="w-4 h-4" /> تحديث
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الطلب أو اسم العميل..."
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(kindFilter === "local" ? localStatusFilters : statusFilters).map(
              (f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setStatusFilter(f.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === f.value
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-lg font-semibold">لا توجد طلبات</p>
              <p className="text-sm mt-1">جرّب تغيير الفلاتر</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      رقم الطلب
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      النوع
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      العميل
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      الوجبات
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      الإجمالي
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      الحالة
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      الوقت
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span className="font-bold text-sm">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <OrderTypeCell order={order} kind={kindFilter} />
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {order.customerPhone}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {order.items[0]?.mealName}
                        {order.items.length > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            +{order.items.length - 1}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {kindFilter === "online" ? (
                          <StatusCell
                            order={order}
                            pending={updateStatus.isPending}
                            onChange={(next) =>
                              updateStatus.mutate(
                                { id: order.id, data: { status: next } },
                                {
                                  onSuccess: () =>
                                    success("تم تحديث حالة الطلب"),
                                  onError: (e) => error("خطأ", getApiError(e)),
                                },
                              )
                            }
                          />
                        ) : (
                          <LocalOrderStatusBadge
                            status={order.localStatus ?? LocalOrderStatus.OPEN}
                          />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p
                          className="text-xs text-muted-foreground"
                          suppressHydrationWarning
                        >
                          {formatRelativeTime(order.createdAt)}
                        </p>
                        <p
                          className="text-xs text-muted-foreground"
                          suppressHydrationWarning
                        >
                          {formatTime(order.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {kindFilter === "online" &&
                            order.status === OrderStatus.PENDING && (
                              <>
                                <Button
                                  size="icon"
                                  variant="success"
                                  className="w-8 h-8 rounded-lg"
                                  title="قبول"
                                  onClick={() =>
                                    updateStatus.mutate(
                                      {
                                        id: order.id,
                                        data: { status: OrderStatus.CONFIRMED },
                                      },
                                      {
                                        onSuccess: () =>
                                          success("تم قبول الطلب"),
                                        onError: (e) =>
                                          error("خطأ", getApiError(e)),
                                      },
                                    )
                                  }
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="danger"
                                  className="w-8 h-8 rounded-lg"
                                  title="رفض"
                                  onClick={() =>
                                    updateStatus.mutate(
                                      {
                                        id: order.id,
                                        data: { status: OrderStatus.CANCELLED },
                                      },
                                      {
                                        onSuccess: () =>
                                          success("تم رفض الطلب"),
                                        onError: (e) =>
                                          error("خطأ", getApiError(e)),
                                      },
                                    )
                                  }
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 rounded-lg gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">
                                  تفاصيل
                                </span>
                              </Button>
                            </DialogTrigger>
                            <OrderDetailDialog
                              order={order}
                              kind={kindFilter}
                            />
                          </Dialog>
                          {kindFilter === "local" &&
                            order.localStatus !== LocalOrderStatus.VOIDED &&
                            order.localStatus !== LocalOrderStatus.DONE && (
                              <Button
                                size="sm"
                                variant="success"
                                className="h-8 px-3 rounded-lg gap-1.5"
                                title="إنهاء الفاتورة"
                                loading={finishPos.isPending}
                                onClick={async () => {
                                  if (
                                    !(await confirmDialog(
                                      `إنهاء الفاتورة ${order.orderNumber}؟`,
                                    ))
                                  )
                                    return;
                                  finishPos.mutate(
                                    { id: order.id },
                                    {
                                      onSuccess: () =>
                                        success("تم إنهاء الفاتورة"),
                                      onError: (e) =>
                                        error("خطأ", getApiError(e)),
                                    },
                                  );
                                }}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">
                                  إنهاء
                                </span>
                              </Button>
                            )}
                          {kindFilter === "online" &&
                            order.status !== OrderStatus.CANCELLED &&
                            order.status !== OrderStatus.DELIVERED &&
                            order.status !== OrderStatus.REFUNDED && (
                              <Button
                                size="icon"
                                variant="danger"
                                className="w-8 h-8 rounded-lg"
                                title="إلغاء الطلب"
                                onClick={async () => {
                                  if (
                                    !(await confirmDialog(
                                      `إلغاء الطلب ${order.orderNumber}؟`,
                                    ))
                                  )
                                    return;
                                  updateStatus.mutate(
                                    {
                                      id: order.id,
                                      data: { status: OrderStatus.CANCELLED },
                                    },
                                    {
                                      onSuccess: () =>
                                        success("تم إلغاء الطلب"),
                                      onError: (e) =>
                                        error("خطأ", getApiError(e)),
                                    },
                                  );
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          {kindFilter === "local" &&
                            order.localStatus !== LocalOrderStatus.VOIDED &&
                            order.localStatus !== LocalOrderStatus.DONE && (
                              <Button
                                size="icon"
                                variant="danger"
                                className="w-8 h-8 rounded-lg"
                                title="إلغاء الفاتورة"
                                loading={voidPos.isPending}
                                onClick={() => {
                                  const reason = window.prompt(
                                    `إلغاء الفاتورة ${order.orderNumber}؟ سبب الإلغاء (اختياري):`,
                                    "",
                                  );
                                  if (reason === null) return;
                                  voidPos.mutate(
                                    {
                                      id: order.id,
                                      reason: reason.trim() || undefined,
                                    },
                                    {
                                      onSuccess: () =>
                                        success("تم إلغاء الفاتورة"),
                                      onError: (e) =>
                                        error("خطأ", getApiError(e)),
                                    },
                                  );
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 10 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              عرض {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} من {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronRight className="w-4 h-4" /> السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 10 >= total}
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live order tracking dialog ───────────────────────────────────────────────

function OrderTrackingDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  dropoffLat,
  dropoffLng,
  addressText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  dropoffLat: number;
  dropoffLng: number;
  addressText: string;
}) {
  // Only subscribe while the dialog is open — avoids joining a socket room for
  // an order the user never inspected.
  const { driver, connected, isStale } = useOrderTracking(
    open ? orderId : null,
  );

  const pins: MapPin[] = [
    {
      id: "dropoff",
      lat: dropoffLat,
      lng: dropoffLng,
      label: customerName,
      color: "#16A34A",
      popupHtml: `<div style="font-family:inherit;font-size:13px;"><strong>موقع التسليم</strong><br/><span style="color:#666">${customerName}</span></div>`,
    },
  ];
  if (driver) {
    pins.push({
      id: "driver",
      lat: driver.lat,
      lng: driver.lng,
      label: "السائق",
      color: "#1f8a5b",
      popupHtml: `<div style="font-family:inherit;font-size:13px;"><strong>السائق</strong><br/><span style="color:#666">${
        isStale ? "آخر تحديث منذ أكثر من 15 ثانية" : "آخر تحديث الآن"
      }</span></div>`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`تتبع الطلب - ${orderNumber}`}>
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span
              className={
                connected
                  ? "text-green-600 font-semibold"
                  : "text-muted-foreground"
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

        <div className="h-[460px] w-full rounded-xl overflow-hidden border border-border">
          <MapboxMap pins={pins} animate zoom={14} />
        </div>

        {addressText && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <MapPinIcon className="w-3.5 h-3.5 text-primary" />
            {addressText}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
