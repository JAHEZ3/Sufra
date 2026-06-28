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
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type DeliveryStatus =
  | "assigned"
  | "heading_to_restaurant"
  | "picked_up"
  | "heading_to_customer"
  | "delivered"
  | "failed";

export interface OrderCounts {
  total: number;
  today: number;
  week: number;
  month: number;
  delivered: number;
  cancelled: number;
  pending: number;
  preparing: number;
}

export interface RevenueTotals {
  total: number;
  today: number;
  week: number;
  month: number;
  subtotal: number;
  deliveryFees: number;
  discounts: number;
  avgOrderValue: number;
  paidOrders: number;
}

export interface CustomerCounts {
  total: number;
  activeLast30Days: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface RatingTotals {
  avgFoodRating: number;
  avgDeliveryRating: number;
  totalRatings: number;
}

export interface MenuCounts {
  menus: number;
  sections: number;
  meals: number;
  available: number;
  featured: number;
}

export interface AnalyticsOverview {
  orders: OrderCounts;
  revenue: RevenueTotals;
  customers: CustomerCounts;
  ratings: RatingTotals;
  menu: MenuCounts;
  rates: { completionRate: number; cancellationRate: number };
}

export interface OrdersAnalytics extends OrderCounts {
  byStatus: { status: OrderStatus; count: number }[];
  byPaymentMethod: { method: PaymentMethod; count: number; total: number }[];
  last30Days: { day: string; orders: number; revenue: number }[];
  byHour: { hour: number; count: number }[];
}

export interface RevenueAnalytics extends RevenueTotals {
  byPaymentMethod: { method: PaymentMethod; count: number; total: number }[];
  last30Days: { day: string; orders: number; revenue: number }[];
}

export interface TopMeal {
  mealId: string;
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export interface TopCustomer {
  customerId: string;
  orders: number;
  spent: number;
}

export interface CustomersAnalytics extends CustomerCounts {
  top: TopCustomer[];
}

export interface RatingsAnalytics extends RatingTotals {
  distribution: { stars: number; count: number }[];
}

export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  foodRating: number;
  deliveryRating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewsList {
  items: Review[];
  total: number;
  page: number;
  limit: number;
  summary: RatingsAnalytics;
}

// ── Standalone restaurant ratings (customer-app, single score + comment) ──────

export type RestaurantReviewSort = "latest" | "highest" | "lowest";

export interface RestaurantReview {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantRatingSummary {
  average: number;
  total: number;
  /** Always 5 rows, stars 5→1, zero-filled. */
  distribution: { stars: number; count: number }[];
}

export interface RestaurantReviewsList {
  items: RestaurantReview[];
  total: number;
  page: number;
  limit: number;
  summary: RestaurantRatingSummary;
}

export interface DeliveryAnalytics {
  total: number;
  completed: number;
  failed: number;
  avgDistanceKm: number;
  byStatus: { status: DeliveryStatus; count: number }[];
}

export interface PaymentsAnalytics {
  paid: number;
  unpaid: number;
  refunded: number;
  byMethod: { method: PaymentMethod; count: number; total: number }[];
}

export type ReportPeriod = "daily" | "weekly" | "monthly";

export interface PerformanceReport {
  period: ReportPeriod;
  label: string;
  range: { from: string; to: string };
  previous: { from: string; to: string };
  kpis: {
    orders: number;
    delivered: number;
    cancelled: number;
    revenue: number;
    avgOrderValue: number;
    uniqueCustomers: number;
    completionRate: number;
    cancellationRate: number;
  };
  growth: {
    ordersPct: number;
    revenuePct: number;
    deliveredPct: number;
    avgOrderValuePct: number;
    customersPct: number;
  };
  breakdown: { bucket: string; orders: number; revenue: number }[];
  byStatus: { status: OrderStatus; count: number }[];
  byPaymentMethod: { method: PaymentMethod; count: number; total: number }[];
  topMeals: { mealId: string; name: string; quantity: number; revenue: number }[];
  topCustomers: { customerId: string; orders: number; spent: number }[];
  ratings: {
    avgFoodRating: number;
    avgDeliveryRating: number;
    totalRatings: number;
  };
}
