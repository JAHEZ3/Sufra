"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { Store, Clock, Star } from "lucide-react";
import { usePlatformStats } from "@/hooks/useStats";

function CountUpNumber({
  value,
  suffix = "",
  delay = 0,
}: {
  value: number;
  suffix?: string;
  delay?: number;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => {
    if (value >= 1000) return `${Math.round(v / 100) / 10}K`;
    return v % 1 === 0 ? Math.round(v).toString() : v.toFixed(1);
  });
  const ref = useRef(false);

  return (
    <motion.span
      onViewportEnter={() => {
        if (ref.current) return;
        ref.current = true;
        animate(count, value, {
          duration: 2,
          delay,
          ease: "easeOut",
        });
      }}
    >
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}

const STATS = [
  {
    icon: Store,
    key: "restaurantCount" as const,
    suffix: "+",
    labelAr: "مطعم شريك",
    bg: "bg-[#e6f2ec]",
    iconColor: "text-[#1f8a5b]",
    textColor: "text-[#1f8a5b]",
  },
  {
    icon: Clock,
    key: "avgDeliveryMinutes" as const,
    suffix: "",
    labelAr: "دقيقة متوسط التوصيل",
    bg: "bg-blue-50",
    iconColor: "text-blue-500",
    textColor: "text-blue-600",
  },
  {
    icon: Star,
    key: "appRating" as const,
    suffix: "",
    labelAr: "تقييم التطبيق",
    bg: "bg-yellow-50",
    iconColor: "text-yellow-500",
    textColor: "text-yellow-600",
  },
];

export function StatsSection() {
  const { data: stats } = usePlatformStats();

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATS.map(({ icon: Icon, key, suffix, labelAr, bg, iconColor, textColor }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-3xl p-8 text-center shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100"
            >
              <div
                className={`w-16 h-16 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-5`}
              >
                <Icon className={`w-8 h-8 ${iconColor}`} />
              </div>
              <div className={`text-5xl font-black ${textColor} mb-2 tabular-nums`}>
                {stats ? (
                  <CountUpNumber
                    value={stats[key] as number}
                    suffix={suffix}
                    delay={i * 0.2}
                  />
                ) : (
                  "—"
                )}
              </div>
              <p className="text-gray-500 font-semibold text-base">{labelAr}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
