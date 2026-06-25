export interface ApiResponse<T> {
  /** auth-service wraps with `success`; other services omit it. Treat as optional. */
  success?: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  data: null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}
