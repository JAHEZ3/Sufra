"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Bell, MapPin } from "lucide-react";

const SCREENS = [
  {
    label: "الرئيسية",
    emoji: "🏠",
    bg: "from-[#1f8a5b] to-[#176f49]",
  },
  {
    label: "المطاعم",
    emoji: "🍔",
    bg: "from-[#2fa06d] to-[#1f8a5b]",
  },
  {
    label: "الطلب",
    emoji: "📦",
    bg: "from-[#176f49] to-[#145c3c]",
  },
  {
    label: "التتبع",
    emoji: "📍",
    bg: "from-[#1f8a5b] to-[#2fa06d]",
  },
];

export function AppShowcase() {
  return (
    <section id="app" className="section-padding bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4 text-sm py-1.5 px-4">التطبيق</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            شاهد <span className="text-[#1f8a5b]">التطبيق</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            استمتع بتجربة طلب سلسة وسريعة مع واجهة مصممة لراحة المستخدم
          </p>
        </motion.div>

        {/* Phones row */}
        <div className="flex items-end justify-center gap-4 md:gap-6 mb-14 overflow-x-auto pb-4">
          {SCREENS.map((screen, i) => {
            const isCenter = i === 1 || i === 2;
            return (
              <motion.div
                key={screen.label}
                initial={{ opacity: 0, y: isCenter ? 0 : 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className={`shrink-0 ${isCenter ? "scale-105 z-10" : "scale-95 opacity-80"}`}
                style={{ transformOrigin: "bottom center" }}
              >
                <div className="w-44 md:w-52 aspect-[9/19] bg-[#1a1a1a] rounded-[2.5rem] shadow-[0_24px_60px_rgba(0,0,0,0.3),0_0_0_2px_rgba(255,255,255,0.08)] overflow-hidden border-[3px] border-white/10 relative">
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-10" />

                  {/* Status bar */}
                  <div
                    className={`h-10 bg-gradient-to-r ${screen.bg} flex items-end justify-between px-4 pb-1`}
                  >
                    <span className="text-white text-[10px] font-bold">9:41</span>
                    <div className="flex gap-1 items-center">
                      <div className="w-3 h-1.5 bg-white/70 rounded-sm" />
                      <div className="w-1 h-1 bg-white/70 rounded-full" />
                    </div>
                  </div>

                  {/* Screen content */}
                  <div className="bg-[#f2f8f5] flex-1 h-full flex flex-col p-3 gap-2">
                    {/* Search bar */}
                    <div className="bg-white rounded-xl h-8 flex items-center px-3 gap-2 shadow-sm">
                      <div className="w-3 h-3 bg-gray-200 rounded-full" />
                      <div className="flex-1 h-2 bg-gray-100 rounded-full" />
                    </div>

                    {/* Banner */}
                    <div
                      className={`h-16 bg-gradient-to-r ${screen.bg} rounded-xl flex items-center justify-center shadow-md`}
                    >
                      <span className="text-3xl">{screen.emoji}</span>
                    </div>

                    {/* Cards */}
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="bg-white rounded-xl p-2 flex items-center gap-2 shadow-sm"
                      >
                        <div className="w-8 h-8 bg-[#e6f2ec] rounded-lg flex items-center justify-center text-base shrink-0">
                          🍕
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full w-3/4 mb-1.5" />
                          <div className="h-1.5 bg-gray-100 rounded-full w-1/2" />
                        </div>
                        <div className="w-5 h-5 bg-[#1f8a5b]/10 rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Label */}
                <div className="text-center mt-3">
                  <span className="text-sm font-semibold text-gray-500">{screen.label}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Features below phones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: ShoppingCart,
              title: "طلب في ثوانٍ",
              desc: "اختر مطعمك وأضف العناصر لسلة التسوق بضغطة واحدة",
            },
            {
              icon: MapPin,
              title: "تتبع مباشر",
              desc: "تابع توصيل طلبك على الخريطة في الوقت الفعلي",
            },
            {
              icon: Bell,
              title: "إشعارات فورية",
              desc: "احصل على تنبيهات لحظية عند تحضير وتوصيل طلبك",
            },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-5 bg-gray-50 rounded-2xl"
            >
              <div className="w-11 h-11 bg-[#e6f2ec] rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#1f8a5b]" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Download buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Button size="lg" className="min-w-48">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.2 1.28-2.18 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.73M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            تنزيل من App Store
          </Button>
          <Button size="lg" variant="outline" className="min-w-48">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1f8a5b]">
              <path d="M3.18 23.76c.37.2.8.2 1.18.01l11.62-6.54-2.5-2.5-10.3 9.03zm15.48-9.35L6.04 7.87 3.17.25C2.79.45 2.5.83 2.5 1.34v21.32c0 .5.28.88.67 1.08l10.83-9.33zm2.15-1.2L17.4 11.5l2.41-1.34-2.41-1.35-9.6-5.42 2.79 2.79 8.22 6.03zM4.36.26L16.8 6.78l-2.5 2.5L3.54.24c.25-.13.55-.12.82.02z" />
            </svg>
            تنزيل من Google Play
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
