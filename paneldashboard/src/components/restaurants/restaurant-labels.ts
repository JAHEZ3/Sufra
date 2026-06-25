import { CuisineType, RestaurantStatus } from "@/types/restaurant.types";

export const restaurantStatusLabel: Record<RestaurantStatus, string> = {
  [RestaurantStatus.ACTIVE]: "نشط",
  [RestaurantStatus.PENDING_APPROVAL]: "بانتظار الموافقة",
  [RestaurantStatus.SUSPENDED]: "موقوف",
  [RestaurantStatus.CLOSED]: "مُغلق",
};

export function restaurantStatusBadgeVariant(status: RestaurantStatus) {
  if (status === RestaurantStatus.ACTIVE) return "success" as const;
  if (status === RestaurantStatus.PENDING_APPROVAL) return "warning" as const;
  return "error" as const;
}

export const cuisineLabel: Record<CuisineType, string> = {
  [CuisineType.FAST_FOOD]: "وجبات سريعة",
  [CuisineType.SWEETS]: "حلويات",
  [CuisineType.DRINKS]: "مشروبات",
  [CuisineType.KITCHEN]: "مطبخ",
  [CuisineType.PIZZA]: "بيتزا",
  [CuisineType.SHAWARMA]: "شاورما",
  [CuisineType.GRILLS]: "مشويات",
  [CuisineType.SEAFOOD]: "بحري",
  [CuisineType.SANDWICHES]: "ساندويتشات",
  [CuisineType.BREAKFAST]: "فطور",
  [CuisineType.HEALTHY]: "صحي",
  [CuisineType.ASIAN]: "آسيوي",
  [CuisineType.OTHER]: "أخرى",
};
