import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import type { ApiResponse, VideoDTO } from "@/types/dto";

const VIDEO_KEYS = {
  all: ["videos"] as const,
  featured: () => [...VIDEO_KEYS.all, "featured"] as const,
};

async function fetchFeaturedVideos(): Promise<VideoDTO[]> {
  const { data } = await apiClient.get<ApiResponse<VideoDTO[]>>(
    "/public/videos/featured"
  );
  return data.data;
}

export function useFeaturedVideos() {
  return useQuery({
    queryKey: VIDEO_KEYS.featured(),
    queryFn: fetchFeaturedVideos,
    placeholderData: [
      {
        id: "1",
        titleAr: "تجربة التوصيل السريع",
        descriptionAr: "تم التوصيل في أقل من 30 دقيقة",
        thumbnailUrl: "/images/video-thumb-1.jpg",
        videoUrl: "#",
        durationSeconds: 124,
        viewCount: 12400,
      },
      {
        id: "2",
        titleAr: "كيفية استخدام تطبيق جاهز",
        descriptionAr: "تعرف على طريقة طلب الطعام",
        thumbnailUrl: "/images/video-thumb-2.jpg",
        videoUrl: "#",
        durationSeconds: 98,
        viewCount: 8900,
      },
    ],
  });
}
