"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Star, Clock, Store, ShoppingBag, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlatformStats } from "@/hooks/useStats";

function formatNum(n: number | undefined): string {
  if (n === undefined) return "";
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" },
  }),
};

export function HeroSection() {
  const { data: stats } = usePlatformStats();

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden gradient-hero"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-[#145c3c]/30 blur-3xl" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-24 pb-16 md:pt-28 md:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Side (Right in RTL) */}
          <motion.div
            className="flex flex-col gap-6"
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} custom={0}>
              <Badge variant="white" className="text-sm py-1.5 px-4 w-fit">
                <Star className="w-3.5 h-3.5 fill-white" />
                رقم 1 في فلسطين
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight"
            >
              أكبر قائمة
              <br />
              <span className="text-white/90">طعام في فلسطين</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-white/80 text-lg leading-relaxed max-w-lg"
            >
              اطلب من أفضل المطاعم واستمتع بتجربة توصيل سريع وخدمة ممتازة. أكثر
              من {formatNum(stats?.restaurantCount)} مطعم في انتظارك.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Button
                asChild
                size="xl"
                variant="secondary"
                className="font-bold shadow-2xl"
              >
                <Link href="/download">
                  <ShoppingBag className="w-5 h-5" />
                  اطلب الان
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-none backdrop-blur-sm font-bold"
              >
                <Link href="/download">
                  <Download className="w-5 h-5" />
                  حمّل التطبيق
                </Link>
              </Button>
            </motion.div>

            {/* Mini stats */}
            <motion.div
              variants={fadeUp}
              custom={4}
              className="flex items-center gap-6 pt-2"
            >
              {[
                {
                  icon: Store,
                  value: `${formatNum(stats?.restaurantCount)}+`,
                  label: "مطعم",
                },
                {
                  icon: Clock,
                  value: `${stats?.avgDeliveryMinutes}`,
                  label: "دقيقة توصيل",
                },
                {
                  icon: Star,
                  value: `${stats?.appRating}`,
                  label: "تقييم التطبيق",
                },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-black text-lg leading-none">
                      {value}
                    </div>
                    <div className="text-white/60 text-xs">{label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Phone Mockup Side */}
          <motion.div
            className="flex justify-center lg:justify-center items-center relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
          >
            <div className="relative w-64 md:w-72">
              {/* Glow blob behind phone */}
              <div className="absolute inset-[-20%] bg-white/15 blur-[60px] rounded-full pointer-events-none" />

              {/* ── iPhone frame ── */}
              <div className="relative animate-float drop-shadow-[0_40px_60px_rgba(0,0,0,0.5)]">
                {/* Outer shell */}
                <div
                  className="relative w-full rounded-[3.2rem] overflow-hidden"
                  style={{
                    background: "linear-gradient(145deg,#2a2a2a,#111)",
                    padding: "3px",
                    boxShadow:
                      "0 0 0 1px rgba(255,255,255,0.12), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  {/* Side buttons (decorative) */}
                  <div className="absolute -right-[3px] top-24 w-[3px] h-8 bg-[#333] rounded-r-full" />
                  <div className="absolute -right-[3px] top-36 w-[3px] h-12 bg-[#333] rounded-r-full" />
                  <div className="absolute -left-[3px] top-32 w-[3px] h-16 bg-[#333] rounded-l-full" />

                  {/* Screen */}
                  <div
                    className="rounded-[3rem] overflow-hidden bg-[#f2f8f5]"
                    style={{ aspectRatio: "9/19.5" }}
                  >
                    {/* ── STATUS BAR ── */}
                    <div className="bg-[#1f8a5b] px-5 pt-3 pb-1.5 flex items-center justify-between">
                      <span className="text-white text-[10px] font-bold tracking-wide">
                        9:41
                      </span>
                      {/* Notch pill */}
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
                      <div className="flex items-center gap-1">
                        {/* Signal bars */}
                        <svg
                          viewBox="0 0 16 10"
                          className="w-3.5 h-2.5 fill-white"
                        >
                          <rect x="0" y="6" width="3" height="4" rx="0.5" />
                          <rect x="4.5" y="4" width="3" height="6" rx="0.5" />
                          <rect x="9" y="2" width="3" height="8" rx="0.5" />
                          <rect
                            x="13.5"
                            y="0"
                            width="3"
                            height="10"
                            rx="0.5"
                            opacity="0.4"
                          />
                        </svg>
                        {/* Wifi */}
                        <svg
                          viewBox="0 0 16 12"
                          className="w-3 h-2.5 fill-white"
                        >
                          <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0-3.5a6 6 0 014.24 1.76l-1.42 1.42A4 4 0 008 8a4 4 0 00-2.83 1.17L3.76 7.76A6 6 0 018 6zm0-3.5a9.5 9.5 0 016.72 2.78L13.3 6.7A7.5 7.5 0 008 4.5a7.5 7.5 0 00-5.3 2.2L1.28 5.28A9.5 9.5 0 018 2.5z" />
                        </svg>
                        {/* Battery */}
                        <div className="flex items-center gap-0.5">
                          <div className="w-5 h-2.5 border border-white rounded-sm relative">
                            <div className="absolute inset-0.5 right-1 bg-white rounded-[1px]" />
                          </div>
                          <div className="w-0.5 h-1.5 bg-white/70 rounded-r-sm" />
                        </div>
                      </div>
                    </div>

                    {/* ── APP HEADER ── */}
                    <div className="bg-[#1f8a5b] px-4 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-white/70 text-[9px]">
                            توصيل إلى
                          </div>
                          <div className="text-white text-xs font-black flex items-center gap-1">
                            رام الله، فلسطين
                            <svg
                              viewBox="0 0 12 8"
                              className="w-2.5 h-2 fill-white mt-0.5"
                            >
                              <path
                                d="M1 1l5 5 5-5"
                                stroke="white"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3.5 h-3.5 fill-white"
                          >
                            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                          </svg>
                        </div>
                      </div>
                      {/* Search bar */}
                      <div className="bg-white rounded-xl flex items-center gap-2 px-3 py-2 shadow-md">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 fill-gray-400 shrink-0"
                        >
                          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <span className="text-gray-400 text-[10px]">
                          ابحث عن مطعم أو طبق...
                        </span>
                      </div>
                    </div>

                    {/* ── PROMO BANNER ── */}
                    <div
                      className="mx-3 mt-3 rounded-2xl overflow-hidden shadow-md relative"
                      style={{ height: "72px" }}
                    >
                      <div className="absolute inset-0 bg-linear-to-l from-[#1f8a5b] via-[#259e66] to-[#176f49]" />
                      <div className="absolute inset-0 flex items-center justify-between px-4">
                        <div>
                          <div className="text-white text-[8px] font-semibold opacity-80">
                            عرض خاص اليوم
                          </div>
                          <div className="text-white text-lg font-black leading-none">
                            20% خصم
                          </div>
                          <div className="text-white/80 text-[8px]">
                            على أول طلب لك
                          </div>
                        </div>
                        <div className="text-4xl">🍔</div>
                      </div>
                      {/* dots indicator */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className={`h-1 rounded-full ${i === 0 ? "w-4 bg-white" : "w-1 bg-white/40"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* ── CATEGORIES ── */}
                    <div className="px-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-900 text-[10px] font-black">
                          الأصناف
                        </span>
                        <span className="text-[#1f8a5b] text-[9px] font-semibold">
                          الكل
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { emoji: "🍔", label: "برغر" },
                          { emoji: "🍕", label: "بيتزا" },
                          { emoji: "🥗", label: "صحي" },
                          { emoji: "🍜", label: "آسيوي" },
                        ].map((cat, i) => (
                          <div
                            key={cat.label}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <div
                              className={`w-full aspect-square rounded-xl flex items-center justify-center text-base shadow-sm ${i === 0 ? "bg-[#1f8a5b]" : "bg-white"}`}
                            >
                              {cat.emoji}
                            </div>
                            <span
                              className={`text-[8px] font-semibold ${i === 0 ? "text-[#1f8a5b]" : "text-gray-500"}`}
                            >
                              {cat.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── RESTAURANTS ── */}
                    <div className="px-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-900 text-[10px] font-black">
                          مطاعم مميزة
                        </span>
                        <span className="text-[#1f8a5b] text-[9px] font-semibold">
                          المزيد
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          {
                            emoji: "🍔",
                            name: "برغر كينج",
                            tag: "برغر",
                            time: "20-25",
                            rating: "4.8",
                            fee: "مجاني",
                          },
                          {
                            emoji: "🍕",
                            name: "بيتزا هت",
                            tag: "بيتزا",
                            time: "25-35",
                            rating: "4.7",
                            fee: "₪5",
                          },
                          {
                            emoji: "🌮",
                            name: "تاكو بيل",
                            tag: "مكسيكي",
                            time: "15-20",
                            rating: "4.6",
                            fee: "₪3",
                          },
                        ].map((r) => (
                          <div
                            key={r.name}
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50"
                          >
                            {/* Cover strip */}
                            <div className="h-10 bg-linear-to-r from-[#e6f2ec] to-[#d3ebe0] flex items-center justify-end px-3">
                              <span className="text-xl">{r.emoji}</span>
                            </div>
                            <div className="px-2.5 pb-2 pt-1.5 flex items-center justify-between">
                              <div>
                                <div className="text-[10px] font-black text-gray-900">
                                  {r.name}
                                </div>
                                <div className="text-[8px] text-gray-400">
                                  {r.tag} · {r.time} دقيقة
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-[#1f8a5b] text-[#1f8a5b]" />
                                  <span className="text-[9px] font-bold text-gray-700">
                                    {r.rating}
                                  </span>
                                </div>
                                <span
                                  className={`text-[8px] font-semibold ${r.fee === "مجاني" ? "text-green-600" : "text-gray-500"}`}
                                >
                                  {r.fee}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── BOTTOM NAV ── */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                      {[
                        { icon: "🏠", label: "الرئيسية", active: true },
                        { icon: "🔍", label: "بحث", active: false },
                        { icon: "🛒", label: "طلباتي", active: false },
                        { icon: "👤", label: "حسابي", active: false },
                      ].map((tab) => (
                        <div
                          key={tab.label}
                          className="flex flex-col items-center gap-0.5"
                        >
                          <span className="text-sm">{tab.icon}</span>
                          <span
                            className={`text-[7px] font-semibold ${tab.active ? "text-[#1f8a5b]" : "text-gray-400"}`}
                          >
                            {tab.label}
                          </span>
                          {tab.active && (
                            <div className="w-3 h-0.5 bg-[#1f8a5b] rounded-full" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* /screen */}
                </div>
                {/* /outer shell */}
              </div>
              {/* /animate-float */}

              {/* ── Floating notification chips ── */}
              <motion.div
                className="absolute -right-10 top-16 bg-white rounded-2xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-gray-100/80"
                initial={{ opacity: 0, x: 24, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  delay: 1.1,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#1f8a5b] rounded-xl flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(31,138,91,0.4)]">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-gray-900 text-[11px] font-bold leading-none mb-0.5">
                      توصيل سريع
                    </div>
                    <div className="text-gray-400 text-[9px]">
                      أقل من 30 دقيقة
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -left-10 top-1/2 bg-white rounded-2xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-gray-100/80"
                initial={{ opacity: 0, x: -24, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  delay: 1.3,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-yellow-50 rounded-xl flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div>
                    <div className="text-gray-900 text-[11px] font-bold leading-none mb-0.5">
                      4.8 ★ تقييم
                    </div>
                    <div className="text-gray-400 text-[9px]">
                      +10,000 تقييم
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-6 bottom-24 bg-[#1f8a5b] rounded-2xl px-3 py-2.5 shadow-[0_8px_32px_rgba(31,138,91,0.4)]"
                initial={{ opacity: 0, x: 24, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  delay: 1.5,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛵</span>
                  <div>
                    <div className="text-white text-[10px] font-bold leading-none mb-0.5">
                      طلبك في الطريق
                    </div>
                    <div className="text-white/70 text-[8px]">
                      يصل خلال 12 دقيقة
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Wave bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 80L48 69.3C96 59 192 37 288 29.3C384 21 480 27 576 37.3C672 48 768 64 864 64C960 64 1056 48 1152 40C1248 32 1344 32 1392 32H1440V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
