// Mirrors response shapes from manager-service `analytics.service.ts`.
// Backend wraps each payload in `{ data, message }` — these types describe `data`.

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "cash_on_delivery" | "card" | "online";

export type RestaurantStatus =
  | "pending_approval"
  | "active"
  | "suspended"
  | "rejected";

export type AgentStatus =
  | "pending_approval"
  | "active"
  | "suspended"
  | "offline"
  | "rejected";

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "failed"
  | "cancelled";

export interface OrderCounts {
  total: number;
  today: number;
  week: number;
  month: number;
  delivered: number;
  cancelled: number;
}

export interface RestaurantCounts {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  openNow: number;
}

export interface CustomerCounts {
  total: number;
  profileCompleted: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  activeLast30Days: number;
}

export interface AgentCounts {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  offline: number;
}

export interface UserCounts {
  total: number;
  active: number;
  suspended: number;
  banned: number;
  byRole: Record<string, number>;
}

export interface RevenueTotals {
  total: number;
  today: number;
  week: number;
  month: number;
  avgOrderValue: number;
  paidOrders: number;
}

export interface PublicStats {
  restaurants: number;
  customers: number;
  completedOrders: number;
  uptimePercent: number;
}

export interface OverviewAnalytics {
  orders: OrderCounts;
  restaurants: RestaurantCounts;
  customers: CustomerCounts;
  agents: AgentCounts;
  users: UserCounts;
  revenue: RevenueTotals;
}

export interface StatusBucket<S extends string = string> {
  status: S;
  count: number;
}

export interface PaymentMethodBucket {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface DailyPoint {
  day: string;
  orders: number;
  revenue: number;
}

export interface OrdersAnalytics extends OrderCounts {
  byStatus: StatusBucket<OrderStatus>[];
  byPaymentMethod: PaymentMethodBucket[];
  last30Days: DailyPoint[];
}

export interface RevenueAnalytics extends RevenueTotals {
  byPaymentMethod: PaymentMethodBucket[];
  last30Days: DailyPoint[];
}

export interface CuisineBucket {
  cuisine: string;
  count: number;
}

export interface CityBucket {
  city: string;
  count: number;
}

export interface TopRestaurant {
  id: string;
  name: string;
  city: string;
  orders: number;
  revenue: number;
}

export interface RestaurantsAnalytics extends RestaurantCounts {
  byStatus: StatusBucket<RestaurantStatus>[];
  byCuisine: CuisineBucket[];
  byCity: CityBucket[];
  top: TopRestaurant[];
}

export interface WalletTotals {
  total: number;
  avg: number;
}

export interface TopCustomer {
  customerId: string;
  orders: number;
  spent: number;
}

export interface CustomersAnalytics extends CustomerCounts {
  walletTotals: WalletTotals;
  top: TopCustomer[];
}

export interface DeliveryCounts {
  total: number;
  completed: number;
  failed: number;
  todayCompleted: number;
  monthCompleted: number;
  totalAgentEarnings: number;
}

export interface TopAgent {
  id: string;
  name: string;
  deliveries: number;
  earnings: number;
}

export interface DeliveryAnalytics {
  agents: AgentCounts;
  deliveries: DeliveryCounts;
  byStatus: StatusBucket<DeliveryStatus>[];
  topAgents: TopAgent[];
}

export interface PaymentsAnalytics {
  transactionTotal: number;
  transactionCount: number;
  transactionMonth: number;
  paidOrders: number;
  unpaidOrders: number;
  byMethod: { method: string; count: number; total: number }[];
}
