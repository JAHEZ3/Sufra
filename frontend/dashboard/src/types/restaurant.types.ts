import type { PaymentInfo } from "./payment.types";

export enum RestaurantStatus {
  PENDING_APPROVAL = "pending_approval",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CLOSED = "closed",
}

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  minOrderAmount: number;
  currencyType: string | null;
  rating: number;
  totalRatings: number;
  status: RestaurantStatus;
  isOpen: boolean;
  paymentInfo: PaymentInfo | null;
  // ESC/POS thermal printers (LAN). Null IP disables that target.
  kitchenPrinterIp: string | null;
  kitchenPrinterPort: number | null;
  cashierPrinterIp: string | null;
  cashierPrinterPort: number | null;
  createdAt: string;
}

export interface RestaurantHour {
  id: string;
  restaurantId: string;
  dayOfWeek: number; // 0=Sun ... 6=Sat
  openTime: string;  // "09:00"
  closeTime: string; // "22:00"
  isClosed: boolean;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  rating: number;
  totalRatings: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}
