"use client";

import { motion } from "framer-motion";
import {
  Zap,
  ShieldCheck,
  Clock,
  Star,
  Gift,
  HeadphonesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Zap,
    titleAr: "طلب سهل",
    descAr: "واجهة بسيطة وسريعة تتيح لك الطلب في ثوانٍ",
    color: "bg-emerald-50 text-[#1f8a5b]",
  },
  {
    icon: Clock,
    titleAr: "توصيل سريع",
    descAr: "نوصل طلبك في أقل من 30 دقيقة في أي مكان",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Star,
    titleAr: "تشكيلة واسعة",
    descAr: "أكثر من 1200 مطعم بكل المطابخ والأذواق",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    icon: Gift,
    titleAr: "برنامج النقاط",
    descAr: "اكسب نقاطاً مع كل طلب واستبدلها بخصومات",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: ShieldCheck,
    titleAr: "دفع آمن",
    descAr: "خيارات دفع متعددة وآمنة بالكامل",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: HeadphonesIcon,
    titleAr: "دعم متواصل",
    descAr: "فريق دعم متاح 24/7 لمساعدتك في أي وقت",
    color: "bg-red-50 text-red-600",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function WhySufra() {
  return (
    <section id="why" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4 text-sm py-1.5 px-4">
            مزاياتنا
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            لماذا تختار{" "}
            <span className="text-[#1f8a5b]">جاهز؟</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            اكتشف المزايا التي تجعل جاهز الخيار الأول لتوصيل الطعام في فلسطين
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.titleAr}
                variants={cardVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group bg-white rounded-2xl p-7 border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(31,138,91,0.12)] hover:border-[#1f8a5b]/20 transition-all duration-300 cursor-default"
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.titleAr}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {feature.descAr}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
