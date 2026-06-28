export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  total: number;
  unread: number;
}

export type NotificationTargetRole =
  | "customer"
  | "restaurant_owner"
  | "delivery"
  | "manager";

export interface BroadcastNotificationPayload {
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  role?: NotificationTargetRole;
}

export interface SendToPhonePayload {
  phone: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface BroadcastResult {
  recipients: number;
}
