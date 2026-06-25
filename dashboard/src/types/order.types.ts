export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY_FOR_PICKUP = "ready_for_pickup",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = "cash_on_delivery",
  CARD = "card",
  ONLINE = "online",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PAID = "paid",
  REFUNDED = "refunded",
}

export enum LocalServiceType {
  DINE_IN = "dine_in",
  TAKEAWAY = "takeaway",
}

export enum LocalOrderStatus {
  OPEN = "open",
  PREPARING = "preparing",
  DONE = "done",
  VOIDED = "voided",
}

export interface OrderItem {
  id: string;
  mealId: string;
  mealName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

export interface DeliveryAddressSnapshot {
  street?: string;
  city?: string;
  lat?: number;
  lng?: number;
  label?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  restaurantId: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerNotes: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  // Set when an online order's status flips to PREPARING. Drives the 15-min
  // dashboard countdown that mirrors the server auto-ready timer.
  preparingStartedAt: string | null;
  receiptKey: string | null;
  paymentProofKey: string | null;
  createdAt: string;
  items: OrderItem[];
  // Local POS only — undefined for online delivery orders.
  serviceType?: LocalServiceType | null;
  tableNumber?: string | null;
  localStatus?: LocalOrderStatus | null;
  paymentSplits?: PaymentSplit[] | null;
  // Online orders only. Captured at checkout from the customer's chosen address.
  deliveryAddress?: DeliveryAddressSnapshot | null;
}

export interface PaymentSplit {
  id?: string;
  amount: number;
  method: string;
  paidAt: string;
  payerName?: string | null;
  reference?: string | null;
}

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export type OrderKindFilter = "online" | "local";

export interface OrderFilters {
  kind?: OrderKindFilter;
  // OrderStatus values for online, LocalOrderStatus values (open/closed/voided) for local
  status?: string;
  page?: number;
  limit?: number;
  restaurantId?: string;
}

// Backend persists *_snapshot fields (immutable history). Normalize to the
// canonical names the UI reads. Tolerates both shapes so a future API change
// (e.g. server pre-mapping) doesn't crash the dashboard.
type RawOrderItem = Partial<OrderItem> & {
  mealNameSnapshot?: string;
  unitPriceSnapshot?: number | string;
  totalPrice?: number | string;
};

type RawOrder = Partial<Order> & {
  customerNameSnapshot?: string;
  customerPhoneSnapshot?: string;
  restaurantNameSnapshot?: string;
  items?: RawOrderItem[];
  subtotal?: number | string;
  deliveryFee?: number | string;
  discountAmount?: number | string;
  totalAmount?: number | string;
  receipt_key?: string | null;
  paymentProofKey?: string | null;
  payment_proof_key?: string | null;
  serviceType?: string | null;
  service_type?: string | null;
  tableNumber?: string | null;
  table_number?: string | null;
  preparing_started_at?: string | null;
  localStatus?: string | null;
  local_status?: string | null;
  paymentSplits?: Array<{ id?: string; amount: number | string; method: string; paidAt: string; payerName?: string | null; reference?: string | null }> | null;
  payment_splits?: Array<{ id?: string; amount: number | string; method: string; paidAt: string; payerName?: string | null; payer_name?: string | null; reference?: string | null }> | null;
  deliveryAddress?: DeliveryAddressSnapshot | null;
  deliveryAddressSnapshot?: DeliveryAddressSnapshot | null;
  delivery_address_snapshot?: DeliveryAddressSnapshot | null;
};

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export function normalizeOrderItem(raw: RawOrderItem): OrderItem {
  return {
    id: raw.id ?? "",
    mealId: raw.mealId ?? "",
    mealName: raw.mealName ?? raw.mealNameSnapshot ?? "",
    quantity: num(raw.quantity),
    unitPrice: num(raw.unitPrice ?? raw.unitPriceSnapshot),
    totalPrice: num(raw.totalPrice),
    notes: raw.notes ?? null,
  };
}

export function normalizeOrder(raw: RawOrder): Order {
  return {
    id: raw.id ?? "",
    orderNumber: raw.orderNumber ?? "",
    customerId: raw.customerId ?? "",
    customerName: raw.customerName ?? raw.customerNameSnapshot ?? "—",
    customerPhone: raw.customerPhone ?? raw.customerPhoneSnapshot ?? "",
    restaurantId: raw.restaurantId ?? "",
    status: (raw.status as OrderStatus) ?? OrderStatus.PENDING,
    subtotal: num(raw.subtotal),
    deliveryFee: num(raw.deliveryFee),
    discountAmount: num(raw.discountAmount),
    totalAmount: num(raw.totalAmount),
    paymentMethod: (raw.paymentMethod as PaymentMethod) ?? PaymentMethod.CASH_ON_DELIVERY,
    paymentStatus: (raw.paymentStatus as PaymentStatus) ?? PaymentStatus.UNPAID,
    customerNotes: raw.customerNotes ?? null,
    estimatedDeliveryAt: raw.estimatedDeliveryAt ?? null,
    deliveredAt: raw.deliveredAt ?? null,
    preparingStartedAt: raw.preparingStartedAt ?? raw.preparing_started_at ?? null,
    receiptKey: raw.receiptKey ?? raw.receipt_key ?? null,
    paymentProofKey: raw.paymentProofKey ?? raw.payment_proof_key ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeOrderItem) : [],
    serviceType: (raw.serviceType ?? raw.service_type ?? null) as LocalServiceType | null,
    tableNumber: raw.tableNumber ?? raw.table_number ?? null,
    localStatus: (raw.localStatus ?? raw.local_status ?? null) as LocalOrderStatus | null,
    paymentSplits: (() => {
      const splits = raw.paymentSplits ?? raw.payment_splits ?? null;
      if (!Array.isArray(splits)) return null;
      return splits.map((s) => {
        const wider = s as typeof s & { payer_name?: string | null };
        return {
          id: s.id,
          amount: num(s.amount),
          method: String(s.method ?? ""),
          paidAt: String(s.paidAt ?? ""),
          payerName: s.payerName ?? wider.payer_name ?? null,
          reference: s.reference ?? null,
        };
      });
    })(),
    deliveryAddress:
      raw.deliveryAddress ??
      raw.deliveryAddressSnapshot ??
      raw.delivery_address_snapshot ??
      null,
  };
}
