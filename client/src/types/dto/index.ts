// ─── API Response Wrapper ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
  statusCode: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Restaurant DTOs ─────────────────────────────────────────────────────────

export interface RestaurantDTO {
  id: string;
  nameAr: string;
  nameEn: string;
  logoUrl: string;
  coverUrl: string;
  categoryId: string;
  categoryNameAr: string;
  rating: number;
  reviewCount: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  minimumOrder: number;
  isOpen: boolean;
  isFeatured: boolean;
  city: string;
  address: string;
  createdAt: string;
}

export interface RestaurantCardDTO
  extends Pick<
    RestaurantDTO,
    | "id"
    | "nameAr"
    | "logoUrl"
    | "coverUrl"
    | "rating"
    | "deliveryTimeMin"
    | "deliveryTimeMax"
    | "deliveryFee"
    | "isOpen"
    | "categoryNameAr"
  > {}

export interface RestaurantQueryParams {
  page?: number;
  limit?: number;
  cityId?: string;
  categoryId?: string;
  search?: string;
  sortBy?: "rating" | "deliveryTime" | "deliveryFee";
}

// ─── Category DTOs ────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: string;
  nameAr: string;
  nameEn: string;
  iconUrl: string;
  restaurantCount: number;
}

// ─── Stats DTO ────────────────────────────────────────────────────────────────

export interface PlatformStatsDTO {
  restaurantCount: number;
  avgDeliveryMinutes: number;
  appRating: number;
  cityCount: number;
  orderCount: number;
  deliveryPartnerCount: number;
}

// ─── Video DTOs ───────────────────────────────────────────────────────────────

export interface VideoDTO {
  id: string;
  titleAr: string;
  descriptionAr: string;
  thumbnailUrl: string;
  videoUrl: string;
  durationSeconds: number;
  viewCount: number;
}

// ─── Partner DTOs ─────────────────────────────────────────────────────────────

export interface RestaurantPartnerRequestDTO {
  ownerName: string;
  restaurantNameAr: string;
  phone: string;
  city: string;
  email?: string;
}

export interface DeliveryPartnerRequestDTO {
  fullName: string;
  phone: string;
  city: string;
  vehicleType: "motorcycle" | "car" | "bicycle";
  hasLicense: boolean;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface LoginDTO {
  phone: string;
  password: string;
}

export interface RegisterDTO {
  fullName: string;
  phone: string;
  password: string;
  cityId: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  user: UserDTO;
}

// ─── User DTO ─────────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  city: string;
  createdAt: string;
}

// ─── City DTO ─────────────────────────────────────────────────────────────────

export interface CityDTO {
  id: string;
  nameAr: string;
  isActive: boolean;
}

// ─── Contact DTOs ─────────────────────────────────────────────────────────────

export type ContactSubject =
  | "general"
  | "order_issue"
  | "restaurant_join"
  | "driver_join"
  | "complaint"
  | "other";

export interface ContactInfoDTO {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string | null;
  supportAddress: string | null;
  supportHours: string | null;
  logoUrl: string | null;
  // Social media (added 2026-05)
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  // App stores
  appStoreUrl?: string | null;
  googlePlayUrl?: string | null;
  // Public website CTA button URLs (route targets for "register restaurant",
  // "register driver", "download app" buttons in Navbar + JoinUsSection)
  restaurantSignupUrl?: string | null;
  driverSignupUrl?: string | null;
  appDownloadUrl?: string | null;
  // SEO
  seoTitleTemplate?: string | null;
  seoDescription?: string | null;
  seoOgImageUrl?: string | null;
}

export interface ContactSubmitDTO {
  name: string;
  email: string;
  phone?: string;
  subject?: ContactSubject;
  title: string;
  message: string;
}

export interface ContactSubmitResponseDTO {
  id: string;
  createdAt: string;
}
