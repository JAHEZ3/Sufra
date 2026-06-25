import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RefreshCw, CheckCircle2, XCircle, Clock, Phone, MessageCircle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "سياسة الإرجاع | جاهز",
  description: "سياسة الإرجاع والاسترداد الخاصة بمنصة جاهز.",
};

const ACCEPTED = [
  "الطلب مختلف تماماً عما تم طلبه",
  "غياب أصناف من الطلب",
  "الطعام تالف أو فاسد عند الاستلام",
  "تأخر التوصيل أكثر من ساعتين",
  "جودة الطعام منخفضة جداً وغير مطابقة للوصف",
];

const REJECTED = [
  "تغيير رأيك بعد استلام الطلب",
  "الطلب مكتمل وتم توصيله بشكل صحيح",
  "مرور أكثر من ساعة على الاستلام دون إبلاغ",
  "المشكلة ناتجة عن تعليمات خاصة غير واضحة",
];

const STEPS = [
  {
    step: "1",
    title: "افتح التطبيق",
    desc: "انتقل إلى قسم 'طلباتي' واختر الطلب المعني",
  },
  {
    step: "2",
    title: "اضغط 'الإبلاغ عن مشكلة'",
    desc: "اختر نوع المشكلة من القائمة المتاحة",
  },
  {
    step: "3",
    title: "أرفق دليلاً (اختياري)",
    desc: "أرسل صورة توضح المشكلة لتسريع المعالجة",
  },
  {
    step: "4",
    title: "انتظر المراجعة",
    desc: "يراجع فريقنا الطلب خلال ساعة ويتواصل معك",
  },
];

const REFUND_METHODS = [
  { method: "محفظة جاهز", time: "فوري", note: "الأسرع والأسهل" },
  { method: "البطاقة الائتمانية", time: "3–7 أيام عمل", note: "حسب سياسة البنك" },
  { method: "نقداً عند التوصيل", time: "في الطلب التالي", note: "للدفع النقدي فقط" },
];

export default function ReturnsPage() {
  return (
    <PageLayout>
      <PageHero
        badge="سياسة الإرجاع"
        title="الإرجاع والاسترداد"
        description="رضاك أولويتنا. إذا لم تكن راضياً عن طلبك، نحن هنا لتصحيح الأمور."
      />

      {/* Time notice */}
      <section className="py-10 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-4 bg-[#e6f2ec] border border-[#1f8a5b]/20 rounded-2xl px-6 py-5">
            <Clock className="w-6 h-6 text-[#1f8a5b] shrink-0" />
            <div>
              <p className="font-black text-gray-900">مهم: مدة تقديم الطلب</p>
              <p className="text-gray-600 text-sm mt-0.5">
                يجب الإبلاغ عن أي مشكلة <span className="font-bold text-[#1f8a5b]">خلال ساعة واحدة</span> من استلام طلبك. لن نتمكن من معالجة الطلبات بعد هذا الوقت.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Accepted / Rejected */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900">متى يُقبل طلب الإرجاع؟</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Accepted */}
            <div className="bg-green-50 rounded-3xl p-7 border border-green-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-black text-gray-900 text-lg">حالات مقبولة</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {ACCEPTED.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rejected */}
            <div className="bg-red-50 rounded-3xl p-7 border border-red-100">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-black text-gray-900 text-lg">حالات غير مقبولة</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {REJECTED.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900">كيف تطلب الإرجاع؟</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map(({ step, title, desc }) => (
              <div key={step} className="relative text-center">
                <div className="w-14 h-14 bg-[#1f8a5b] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-black shadow-[0_6px_20px_rgba(31,138,91,0.35)]">
                  {step}
                </div>
                <h4 className="font-black text-gray-900 mb-2">{title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Refund methods */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900">طرق الاسترداد</h2>
          </div>
          <div className="flex flex-col gap-4">
            {REFUND_METHODS.map(({ method, time, note }) => (
              <div key={method} className="flex items-center justify-between bg-gray-50 rounded-2xl px-6 py-5 border border-gray-100">
                <div className="flex items-center gap-4">
                  <RefreshCw className="w-5 h-5 text-[#1f8a5b]" />
                  <div>
                    <p className="font-black text-gray-900">{method}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{note}</p>
                  </div>
                </div>
                <span className="bg-[#e6f2ec] text-[#1f8a5b] font-bold text-sm px-4 py-1.5 rounded-full shrink-0">
                  {time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 gradient-orange text-white">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black mb-3">هل تحتاج مساعدة؟</h2>
          <p className="text-white/80 mb-8">فريق خدمة العملاء جاهز للمساعدة على مدار الساعة.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+97059000000"
              className="flex items-center justify-center gap-2 bg-white text-[#1f8a5b] font-black px-7 py-3.5 rounded-2xl hover:bg-[#e6f2ec] transition-colors"
            >
              <Phone className="w-5 h-5" />
              اتصل الآن
            </a>
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 bg-white/20 text-white border border-white/30 font-bold px-7 py-3.5 rounded-2xl hover:bg-white/30 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              راسلنا
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
