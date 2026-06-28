export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type ManagerRole = "manager";

export interface ManagerJwtPayload {
  sub: string;
  role: ManagerRole | string;
  email?: string;
  phone?: string;
  profileCompleted?: boolean;
  iat?: number;
  exp?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: ManagerRole | string;
}

export type { ApiError, ApiResponse } from "./common.types";
