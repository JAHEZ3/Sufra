import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { DownloadButtons } from "@/components/sections/DownloadButtons";
import {
  ShoppingCart,
  MapPin,
  Bell,
  Wallet,
  Star,
  Shield,
} from "lucide-react";

export const metadata: Metadata = {
  title: "حمّل التطبيق | جاهز",
  description:
    "حمّل تطبيق جاهز على iPhone أو Android واطلب من أفضل المطاعم في فلسطين.",
};

const FEATURES = [
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
  {
    icon: Wallet,
    title: "محفظة آمنة",
    desc: "ادفع بسهولة وأمان من محفظة جاهز أو بالبطاقة",
  },
  {
    icon: Star,
    title: "تقييمات حقيقية",
    desc: "اقرأ تقييمات الزبائن واختر المطعم الأنسب لك",
  },
  {
    icon: Shield,
    title: "ضمان الجودة",
    desc: "نتابع جودة كل طلب ونضمن لك تجربة ممتازة",
  },
];

export default function DownloadPage() {
  return (
    <PageLayout>
      <PageHero
        badge="حمّل التطبيق"
        title="تطبيق جاهز"
        highlight="على iPhone و Android"
        description="حمّل التطبيق الآن وابدأ تجربة طلب الطعام الأسرع والأسهل في فلسطين."
      />

      {/* Download buttons hero */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <DownloadButtons />
          <p className="mt-6 text-sm text-gray-500">
            متوفر مجاناً على متجر App Store و Google Play
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              لماذا <span className="text-[#1f8a5b]">جاهز</span>؟
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
              كل ما تحتاجه لتجربة طلب طعام سلسة، في تطبيق واحد.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#1f8a5b]/30 hover:shadow-[0_8px_24px_rgba(31,138,91,0.08)] transition-all duration-200"
              >
                <div className="w-12 h-12 bg-[#e6f2ec] rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-[#1f8a5b]" />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 mb-1.5">{title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 gradient-orange text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">
            جاهز للبدء؟
          </h2>
          <p className="text-white/85 mb-8 text-lg">
            حمّل التطبيق الآن واطلب أول وجبة خلال دقائق.
          </p>
          <DownloadButtons />
        </div>
      </section>
    </PageLayout>
  );
}
