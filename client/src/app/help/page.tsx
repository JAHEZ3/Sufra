"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Search, ChevronDown, ChevronUp, ShoppingCart, Truck, CreditCard, User, Store, Star } from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { icon: ShoppingCart, label: "الطلبات", color: "bg-[#e6f2ec] text-[#1f8a5b]" },
  { icon: Truck, label: "التوصيل", color: "bg-blue-50 text-blue-600" },
  { icon: CreditCard, label: "الدفع", color: "bg-green-50 text-green-600" },
  { icon: User, label: "الحساب", color: "bg-purple-50 text-purple-600" },
  { icon: Store, label: "المطاعم", color: "bg-yellow-50 text-yellow-600" },
  { icon: Star, label: "المكافآت", color: "bg-pink-50 text-pink-600" },
];

const FAQS = [
  {
    q: "كيف أضع طلباً عبر جاهز؟",
    a: "افتح التطبيق، اختر مطعمك، أضف الأصناف إلى السلة، ثم اضغط 'إتمام الطلب' واختر طريقة الدفع. ستصلك رسالة تأكيد فور قبول المطعم لطلبك.",
  },
  {
    q: "كم يستغرق وقت التوصيل؟",
    a: "يعتمد وقت التوصيل على المطعم وموقعك. في المتوسط، يصل طلبك خلال 20–35 دقيقة. يمكنك متابعة السائق على الخريطة في الوقت الفعلي.",
  },
  {
    q: "ما طرق الدفع المتاحة؟",
    a: "نقبل الدفع نقداً عند التوصيل، والبطاقات الائتمانية (Visa / Mastercard)، ومحفظة جاهز، وخدمة Apple Pay.",
  },
  {
    q: "كيف أتتبع طلبي؟",
    a: "بعد تأكيد الطلب، افتح قسم 'طلباتي' في التطبيق واضغط على الطلب الحالي. ستظهر لك خريطة حية تُظهر موقع السائق.",
  },
  {
    q: "هل يمكنني إلغاء طلبي؟",
    a: "يمكنك إلغاء الطلب خلال أول 3 دقائق من التأكيد. بعد ذلك، تواصل مع فريق الدعم لمساعدتك.",
  },
  {
    q: "ماذا أفعل إذا كان طلبي ناقصاً أو خاطئاً؟",
    a: "تواصل معنا فوراً عبر التطبيق من خلال 'الإبلاغ عن مشكلة' في صفحة الطلب، أو اتصل بخدمة العملاء على مدار الساعة.",
  },
  {
    q: "كيف أحصل على نقاط المكافآت؟",
    a: "تحصل تلقائياً على نقاط مقابل كل طلب. 1 نقطة لكل ₪1 تُنفقها. يمكن استبدال النقاط بخصومات في طلباتك القادمة.",
  },
  {
    q: "كيف أضيف عنواناً جديداً؟",
    a: "من إعدادات الحساب، اختر 'عناواين التوصيل' ثم 'إضافة عنوان'. يمكنك تحديد الموقع على الخريطة أو إدخاله يدوياً.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${open ? "border-[#1f8a5b]/30 shadow-[0_4px_20px_rgba(31,138,91,0.08)]" : "border-gray-100"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-right"
      >
        <span className="font-bold text-gray-900 text-sm leading-relaxed">{q}</span>
        {open
          ? <ChevronUp className="w-5 h-5 text-[#1f8a5b] shrink-0" />
          : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const filtered = FAQS.filter(f =>
    query.trim() === "" || f.q.includes(query) || f.a.includes(query)
  );

  return (
    <PageLayout>
      <PageHero
        badge="الدعم"
        title="مركز المساعدة"
        description="كيف يمكننا مساعدتك اليوم؟ ابحث عن سؤالك أو تصفح الفئات أدناه."
      />

      {/* Search */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث في مركز المساعدة..."
              className="w-full pr-12 pl-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-[#1f8a5b] focus:ring-4 focus:ring-[#1f8a5b]/10 outline-none text-base transition-all"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-8">تصفح حسب الفئة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {CATEGORIES.map(({ icon: Icon, label, color }) => (
              <button key={label} className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${color.split(" ")[0]} hover:opacity-80 transition-opacity`}>
                <Icon className={`w-6 h-6 ${color.split(" ")[1]}`} />
                <span className="text-xs font-bold text-gray-700">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-900 mb-8 text-center">
            {query ? `نتائج البحث (${filtered.length})` : "الأسئلة الأكثر شيوعاً"}
          </h2>
          {filtered.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filtered.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-500">لم نجد نتائج لـ «{query}»</p>
            </div>
          )}
        </div>
      </section>

      {/* Still need help */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-2">لم تجد إجابتك؟</h2>
          <p className="text-gray-500 mb-8">فريق الدعم لدينا جاهز للمساعدة على مدار الساعة.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 bg-[#1f8a5b] text-white font-black px-8 py-4 rounded-2xl hover:bg-[#176f49] transition-colors shadow-[0_8px_24px_rgba(31,138,91,0.35)]"
            >
              تواصل مع الدعم
            </Link>
            <a
              href="https://wa.me/97059000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-500 text-white font-black px-8 py-4 rounded-2xl hover:bg-green-600 transition-colors"
            >
              واتساب
            </a>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
