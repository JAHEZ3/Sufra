"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Eye, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFeaturedVideos } from "@/hooks/useVideos";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(views: number) {
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

export function VideoSection() {
  const { data: videos = [] } = useFeaturedVideos();
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <section id="videos" className="section-padding gradient-dark relative overflow-hidden">
      {/* BG decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#1f8a5b]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#1f8a5b]/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="white" className="mb-4 text-sm py-1.5 px-4">
            فيديوهات جاهز
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            شاهد <span className="text-[#1f8a5b]">جاهز</span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            اكتشف كيف يعمل جاهز من خلال هذه الفيديوهات التوضيحية
          </p>
        </motion.div>

        {/* Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {videos.map((video, i) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#16201a] cursor-pointer"
                onClick={() => setActiveId(activeId === video.id ? null : video.id)}
              >
                {/* Placeholder gradient as thumbnail */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1d2c24] via-[#16201a] to-[#16201b]" />

                {/* Fake video content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-3">
                      {i === 0 ? "🛵" : "📱"}
                    </div>
                    <div className="text-white/40 text-sm">{video.titleAr}</div>
                  </div>
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-16 h-16 bg-[#1f8a5b] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(31,138,91,0.5)] group-hover:shadow-[0_12px_40px_rgba(31,138,91,0.6)] transition-shadow"
                  >
                    <Play className="w-6 h-6 text-white fill-white mr-[-2px]" />
                  </motion.div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-3 left-3">
                  <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
                    {formatDuration(video.durationSeconds)}
                  </span>
                </div>

                {/* Live badge for first video */}
                {i === 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-[#1f8a5b] text-white text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      جديد
                    </span>
                  </div>
                )}
              </div>

              {/* Video info */}
              <div className="mt-4 px-1">
                <h3 className="text-white font-bold text-lg mb-1 leading-snug">
                  {video.titleAr}
                </h3>
                <p className="text-white/50 text-sm mb-3">{video.descriptionAr}</p>
                <div className="flex items-center gap-4 text-white/40 text-xs">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {formatViews(video.viewCount)} مشاهدة
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(video.durationSeconds)}
                  </span>
                </div>
                <button className="mt-3 text-[#1f8a5b] text-sm font-semibold hover:text-[#2fa06d] transition-colors flex items-center gap-1">
                  شاهد الآن ←
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-white/50 text-sm mb-4">
            هل تريد المزيد من الفيديوهات؟
          </p>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
            شاهد قناتنا على يوتيوب
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
