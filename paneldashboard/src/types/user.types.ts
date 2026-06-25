import type { PaginationParams } from "./common.types";

export enum UserRole {
  CUSTOMER = "customer",
  RESTAURANT_OWNER = "restaurant_owner",
  DELIVERY = "delivery",
  MANAGER = "manager",
}

export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BANNED = "banned",
}

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: UserRole;
  status: UserStatus;
  profileCompleted: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ListUsersParams extends PaginationParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface ChangeUserStatusPayload {
  status: UserStatus;
}

export interface ChangeUserStatusResponse {
  id: string;
  status: UserStatus;
}
