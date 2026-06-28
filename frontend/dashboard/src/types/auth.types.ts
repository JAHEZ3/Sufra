// Matches backend enum exactly
export type RestaurantStatus =
  | "pending_approval"
  | "active"
  | "suspended"
  | "closed";

// Frontend-only routing state (superset of RestaurantStatus)
export type AuthStatus = RestaurantStatus | "pending_profile";

export interface AuthUser {
  sub: string;
  phone: string;
  role: "restaurant_owner" | "admin";
  status: RestaurantStatus;
  profileCompleted?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
}

export interface OtpVerifyResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}
