import type { PaginationParams } from "./common.types";

export enum RestaurantStatus {
  PENDING_APPROVAL = "pending_approval",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CLOSED = "closed",
}

export enum CuisineType {
  FAST_FOOD = "fast_food",
  SWEETS = "sweets",
  DRINKS = "drinks",
  KITCHEN = "kitchen",
  PIZZA = "pizza",
  SHAWARMA = "shawarma",
  GRILLS = "grills",
  SEAFOOD = "seafood",
  SANDWICHES = "sandwiches",
  BREAKFAST = "breakfast",
  HEALTHY = "healthy",
  ASIAN = "asian",
  OTHER = "other",
}

export enum RestaurantRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface PaymentInfo {
  iban?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
}

export interface Restaurant {
  id: string;
  ownerUserId: string;
  name: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  ownerName: string | null;
  ownerNationalIdNumber: string | null;
  commercialRegNumber: string | null;
  cuisineType: CuisineType | null;
  paymentInfo: PaymentInfo | null;
  termsAccepted: boolean;
  street: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  minOrderAmount: number;
  rating: number;
  totalRatings: number;
  status: RestaurantStatus;
  isOpen: boolean;
  createdAt: string;
}

/** Pending owner application joined with its restaurant stub. Image URLs are presigned. */
export interface RestaurantApplication {
  id: string;
  restaurantId: string;
  status: RestaurantRequestStatus;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  logoUrl: string | null;
  ownerIdPictureUrl: string | null;
  restaurant?: Restaurant;
}

export interface ListRestaurantsParams extends PaginationParams {
  status?: RestaurantStatus;
  cuisineType?: CuisineType;
  city?: string;
  search?: string;
}

export interface UpdateRestaurantPayload {
  name?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  phone?: string;
  street?: string;
  city?: string;
  cuisineType?: CuisineType;
  lat?: number;
  lng?: number;
}

export interface ChangeRestaurantStatusPayload {
  status: RestaurantStatus;
}

export interface ChangeRestaurantStatusResponse {
  id: string;
  status: RestaurantStatus;
}

export interface RejectApplicationPayload {
  reason?: string;
}
