export interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  ip?: string;
  userAgent?: string;
  current: boolean;
}

export interface SessionsResponse {
  items: SessionSummary[];
  total: number;
}
