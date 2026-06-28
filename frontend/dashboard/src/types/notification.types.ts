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
