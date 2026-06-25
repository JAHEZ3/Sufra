"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Bike,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useContactInfo } from "@/hooks/useContact";

const RESTAURANT_BENEFITS = [
  "وصول فوري لآلاف العملاء",
  "لوحة تحكم متكاملة لإدارة الطلبات",
  "تقارير مبيعات تفصيلية",
  "دعم فني على مدار الساعة",
  "نظام تسعير شفاف وعادل",
];

const DRIVER_BENEFITS = [
  "حرية في تحديد أوقات العمل",
  "دفع أسبوعي منتظم",
  "مكافآت وحوافز إضافية",
  "تأمين أثناء العمل",
  "دعم فني متواصل",
];

const PLATFORM_NUMBERS = [
  { icon: TrendingUp, value: "₪2500", label: "متوسط دخل السائق شهرياً", color: "text-green-500" },
  { icon: Users, value: "+1200", label: "مطعم شريك", color: "text-[#1f8a5b]" },
  { icon: DollarSign, value: "+800", label: "سائق توصيل", color: "text-blue-500" },
];

type Tab = "restaurant" | "driver";

export function JoinUsSection() {
  const [activeTab, setActiveTab] = useState<Tab>("restaurant");
  const { data: contact } = useContactInfo();
  const restaurantHref = contact?.restaurantSignupUrl ?? "#join";
  const driverHref = contact?.driverSignupUrl ?? "#join";

  return (
    <section id="join" className="section-padding bg-gray-50 relative overflow-hidden">
      {/* BG decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1f8a5b]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
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
          <Badge className="mb-4 text-sm py-1.5 px-4">
            انضم لعائلة جاهز
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            انضم <span className="text-[#1f8a5b]">إلينا</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            كن جزءاً من عائلتنا واكسب المال لأن لدينا خدمة مخصصة
          </p>
        </motion.div>

        {/* Platform numbers */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {PLATFORM_NUMBERS.map(({ icon: Icon, value, label, color }, i) => (
            <motion.div
              key={label}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
            >
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <div className={`text-3xl font-black ${color} mb-1`}>{value}</div>
              <p className="text-gray-500 text-sm font-medium">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Tab cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Restaurant card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="overflow-visible shadow-[0_8px_40px_rgba(31,138,91,0.12)] border-0">
              {/* Card header */}
              <div className="gradient-orange p-7 rounded-t-2xl">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                  <Store className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  انضم كمطعم
                </h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  سجّل مطعمك وابدأ في استقبال الطلبات فوراً
                </p>
              </div>

              <CardContent className="pt-6 pb-7">
                <ul className="flex flex-col gap-3 mb-7">
                  {RESTAURANT_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#1f8a5b] shrink-0" />
                      <span className="text-gray-700 text-sm font-medium">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="w-full text-base font-bold">
                  <a href={restaurantHref}>سجّل مطعمك الآن</a>
                </Button>
                <p className="text-center text-gray-400 text-xs mt-3">
                  مجاناً · بدون رسوم تسجيل
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Driver card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="overflow-visible border-2 border-[#1f8a5b]/20 shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
              {/* Card header */}
              <div className="bg-[#16201b] p-7 rounded-t-2xl">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                  <Bike className="w-7 h-7 text-[#1f8a5b]" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  انضم كسائق
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  اعمل بحريتك واكسب دخلاً ممتازاً مع جاهز
                </p>
              </div>

              <CardContent className="pt-6 pb-7">
                <ul className="flex flex-col gap-3 mb-7">
                  {DRIVER_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#1f8a5b] shrink-0" />
                      <span className="text-gray-700 text-sm font-medium">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant="dark" className="w-full text-base font-bold text-white">
                  <a href={driverHref}>سجّل كسائق الآن</a>
                </Button>
                <p className="text-center text-gray-400 text-xs mt-3">
                  مركبتك الخاصة · انطلق فوراً
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
