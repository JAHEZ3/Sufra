import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { MapPin, Clock, Briefcase, ArrowLeft, Zap, Heart, TrendingUp, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "وظائف | جاهز",
  description: "انضم إلى فريق جاهز وكن جزءاً من أكبر منصة توصيل في فلسطين.",
};

const JOBS = [
  {
    id: 1,
    title: "مطور تطبيقات موبايل (React Native)",
    dept: "التقنية",
    location: "غزة / عن بُعد",
    type: "دوام كامل",
    emoji: "📱",
  },
  {
    id: 2,
    title: "مصمم UI/UX",
    dept: "التصميم",
    location: "غزة",
    type: "دوام كامل",
    emoji: "🎨",
  },
  {
    id: 3,
    title: "أخصائي تسويق رقمي",
    dept: "التسويق",
    location: "رام الله / عن بُعد",
    type: "دوام كامل",
    emoji: "📣",
  },
  {
    id: 4,
    title: "مدير حسابات مطاعم",
    dept: "المبيعات",
    location: "غزة",
    type: "دوام كامل",
    emoji: "🤝",
  },
  {
    id: 5,
    title: "ممثل خدمة العملاء",
    dept: "الدعم",
    location: "عن بُعد",
    type: "دوام جزئي",
    emoji: "🎧",
  },
  {
    id: 6,
    title: "محلل بيانات",
    dept: "التقنية",
    location: "عن بُعد",
    type: "دوام كامل",
    emoji: "📊",
  },
];

const PERKS = [
  { icon: Zap, title: "بيئة عمل ديناميكية", desc: "فريق شاب متحمس يدفعك للنمو المستمر" },
  { icon: Heart, title: "تأمين صحي", desc: "تغطية صحية شاملة لك ولعائلتك" },
  { icon: TrendingUp, title: "مسار مهني واضح", desc: "خطة تطوير مخصصة وترقيات مبنية على الأداء" },
  { icon: Users, title: "ثقافة متنوعة", desc: "نقدر التنوع ونحتفل بالاختلاف" },
];

export default function CareersPage() {
  return (
    <PageLayout>
      <PageHero
        badge="انضم لفريقنا"
        title="وظائف"
        description="نحن نبحث عن أشخاص موهوبين وطموحين لبناء مستقبل توصيل الطعام في فلسطين معنا."
      />

      {/* Perks */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[#1f8a5b] font-bold text-sm uppercase tracking-widest">لماذا جاهز؟</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">
              مزايا العمل معنا
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-[#e6f2ec] transition-colors duration-300">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Icon className="w-7 h-7 text-[#1f8a5b]" />
                </div>
                <h4 className="font-black text-gray-900 mb-2">{title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jobs list */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[#1f8a5b] font-bold text-sm uppercase tracking-widest">الوظائف المتاحة</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">
              فرص العمل الحالية
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {JOBS.map((job) => (
              <div
                key={job.id}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#1f8a5b]/30 hover:shadow-[0_8px_32px_rgba(31,138,91,0.1)] transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#e6f2ec] rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {job.emoji}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-base group-hover:text-[#1f8a5b] transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <Briefcase className="w-3.5 h-3.5" />
                          {job.dept}
                        </span>
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="shrink-0 flex items-center gap-2 bg-[#1f8a5b] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#176f49] transition-colors shadow-[0_4px_12px_rgba(31,138,91,0.3)]">
                    تقدم الآن
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-orange text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-black mb-4">لم تجد ما يناسبك؟</h2>
          <p className="text-white/80 mb-8 leading-relaxed">
            أرسل لنا سيرتك الذاتية وسنتواصل معك عند توفر فرصة مناسبة.
          </p>
          <a
            href="mailto:careers@sufra.ps"
            className="inline-flex items-center gap-2 bg-white text-[#1f8a5b] font-black px-8 py-4 rounded-2xl hover:bg-[#e6f2ec] transition-colors shadow-2xl"
          >
            أرسل سيرتك الذاتية
          </a>
        </div>
      </section>
    </PageLayout>
  );
}
