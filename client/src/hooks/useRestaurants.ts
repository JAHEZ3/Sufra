import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import type {
  PaginatedResponse,
  RestaurantCardDTO,
  RestaurantQueryParams,
  CategoryDTO,
  CityDTO,
  ApiResponse,
} from "@/types/dto";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const RESTAURANT_KEYS = {
  all: ["restaurants"] as const,
  lists: () => [...RESTAURANT_KEYS.all, "list"] as const,
  list: (params: RestaurantQueryParams) =>
    [...RESTAURANT_KEYS.lists(), params] as const,
  categories: () => ["categories"] as const,
  cities: () => ["cities"] as const,
};

// ─── Fetchers ────────────────────────────────────────────────────────────────

async function fetchRestaurants(
  params: RestaurantQueryParams
): Promise<PaginatedResponse<RestaurantCardDTO>> {
  const { data } = await apiClient.get<PaginatedResponse<RestaurantCardDTO>>(
    "/public/restaurants",
    { params }
  );
  return data;
}

async function fetchCategories(): Promise<CategoryDTO[]> {
  const { data } =
    await apiClient.get<ApiResponse<CategoryDTO[]>>("/public/categories");
  return data.data;
}

async function fetchCities(): Promise<CityDTO[]> {
  const { data } =
    await apiClient.get<ApiResponse<CityDTO[]>>("/public/cities");
  return data.data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useRestaurants(params: RestaurantQueryParams = {}) {
  return useQuery({
    queryKey: RESTAURANT_KEYS.list(params),
    queryFn: () => fetchRestaurants(params),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: RESTAURANT_KEYS.categories(),
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 30, // 30 min – rarely changes
  });
}

export function useCities() {
  return useQuery({
    queryKey: RESTAURANT_KEYS.cities(),
    queryFn: fetchCities,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
