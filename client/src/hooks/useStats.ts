import { useQuery } from "@tanstack/react-query";
import { managerClient } from "@/lib/axios";
import type { ApiResponse, PlatformStatsDTO } from "@/types/dto";

const STATS_KEYS = {
  all: ["stats"] as const,
  platform: () => [...STATS_KEYS.all, "platform"] as const,
};

// Hits manager-service (port 3006), not order-service. The endpoint is at
// /api/manager/public/stats; managerClient's baseURL already contains the
// /api/manager prefix, so the relative path is /public/stats.
async function fetchPlatformStats(): Promise<PlatformStatsDTO> {
  const { data } = await managerClient.get<ApiResponse<PlatformStatsDTO>>(
    "/public/stats"
  );
  return data.data;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: STATS_KEYS.platform(),
    queryFn: fetchPlatformStats,
    placeholderData: {
      restaurantCount: 1200,
      avgDeliveryMinutes: 30,
      appRating: 4.6,
      cityCount: 12,
      orderCount: 500000,
      deliveryPartnerCount: 800,
    },
  });
}
