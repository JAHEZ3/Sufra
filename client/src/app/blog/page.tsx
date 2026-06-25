import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Calendar, Clock, ArrowLeft, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "المدونة | جاهز",
  description: "آخر أخبار ومقالات جاهز — توصيل الطعام، الشراكات، وأخبار فلسطين.",
};

const FEATURED = {
  id: 1,
  title: "جاهز تتجاوز مليون طلب ناجح في فلسطين",
  excerpt:
    "في خطوة تاريخية، أعلنت منصة جاهز تجاوزها حاجز المليون طلب، مؤكدةً مكانتها بوصفها المنصة الأولى لتوصيل الطعام في فلسطين.",
  category: "أخبار الشركة",
  date: "1 أبريل 2026",
  readTime: "3 دقائق",
  emoji: "🎉",
};

const POSTS = [
  {
    id: 2,
    title: "كيف تختار المطعم المناسب لمناسبتك؟",
    excerpt: "دليلك الشامل لاختيار أفضل مطعم بناءً على التقييمات والمطبخ والوقت.",
    category: "نصائح",
    date: "28 مارس 2026",
    readTime: "4 دقائق",
    emoji: "🍽️",
  },
  {
    id: 3,
    title: "أفضل 10 مطاعم برغر في غزة لعام 2026",
    excerpt: "قائمتنا المختارة بعناية لأفضل تجارب البرغر في المدينة.",
    category: "دليل المطاعم",
    date: "20 مارس 2026",
    readTime: "6 دقائق",
    emoji: "🍔",
  },
  {
    id: 4,
    title: "شراكات جديدة مع 50 مطعماً في رام الله",
    excerpt: "جاهز توسع شبكتها لتشمل 50 مطعماً جديداً في منطقة رام الله والبيرة.",
    category: "أخبار الشركة",
    date: "15 مارس 2026",
    readTime: "2 دقائق",
    emoji: "🤝",
  },
  {
    id: 5,
    title: "مزايا برنامج النقاط في جاهز — كيف تستفيد أكثر؟",
    excerpt: "دليل خطوة بخطوة لتحقيق أقصى استفادة من نظام المكافآت.",
    category: "نصائح",
    date: "10 مارس 2026",
    readTime: "5 دقائق",
    emoji: "⭐",
  },
  {
    id: 6,
    title: "قصة نجاح: مطعم أم محمد من الشارع إلى جاهز",
    excerpt: "كيف انضمت أم محمد لجاهز وضاعفت مبيعاتها ثلاثة أضعاف في ستة أشهر.",
    category: "قصص نجاح",
    date: "5 مارس 2026",
    readTime: "7 دقائق",
    emoji: "🌟",
  },
];

const CATEGORIES = ["الكل", "أخبار الشركة", "نصائح", "دليل المطاعم", "قصص نجاح"];

const CATEGORY_COLORS: Record<string, string> = {
  "أخبار الشركة": "bg-blue-50 text-blue-600",
  "نصائح": "bg-green-50 text-green-600",
  "دليل المطاعم": "bg-[#e6f2ec] text-[#1f8a5b]",
  "قصص نجاح": "bg-purple-50 text-purple-600",
};

export default function BlogPage() {
  return (
    <PageLayout>
      <PageHero
        badge="المدونة"
        title="آخر الأخبار"
        highlight="والمقالات"
        description="اكتشف أحدث الأخبار والنصائح وقصص النجاح من عالم جاهز وتوصيل الطعام في فلسطين."
      />

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Categories filter */}
          <div className="flex flex-wrap gap-2 mb-12 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                  cat === "الكل"
                    ? "bg-[#1f8a5b] text-white border-[#1f8a5b]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#1f8a5b] hover:text-[#1f8a5b]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Featured post */}
          <div className="mb-10 bg-gradient-to-l from-[#e6f2ec] to-white rounded-3xl p-8 md:p-10 border border-[#1f8a5b]/10 flex flex-col md:flex-row gap-8 items-center">
            <div className="text-8xl shrink-0">{FEATURED.emoji}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${CATEGORY_COLORS[FEATURED.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {FEATURED.category}
                </span>
                <span className="bg-[#1f8a5b] text-white text-xs font-bold px-3 py-1 rounded-full">مميز</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3 leading-tight hover:text-[#1f8a5b] transition-colors cursor-pointer">
                {FEATURED.title}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-5">{FEATURED.excerpt}</p>
              <div className="flex items-center gap-5 text-gray-400 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {FEATURED.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {FEATURED.readTime}
                </span>
                <button className="flex items-center gap-1.5 text-[#1f8a5b] font-bold hover:gap-2.5 transition-all">
                  اقرأ المزيد
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Posts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.map((post) => (
              <article
                key={post.id}
                className="group bg-white rounded-2xl border border-gray-100 hover:border-[#1f8a5b]/20 hover:shadow-[0_8px_32px_rgba(31,138,91,0.1)] transition-all duration-300 overflow-hidden cursor-pointer"
              >
                {/* Cover */}
                <div className="h-36 bg-gradient-to-br from-[#e6f2ec] to-[#d3ebe0] flex items-center justify-center">
                  <span className="text-6xl">{post.emoji}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-3.5 h-3.5 text-gray-300" />
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {post.category}
                    </span>
                  </div>
                  <h3 className="font-black text-gray-900 mb-2 leading-snug group-hover:text-[#1f8a5b] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {post.readTime}
                      </span>
                    </div>
                    <span className="text-[#1f8a5b] font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      اقرأ
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Load more */}
          <div className="text-center mt-12">
            <button className="border-2 border-[#1f8a5b] text-[#1f8a5b] font-bold px-10 py-3.5 rounded-2xl hover:bg-[#e6f2ec] transition-colors">
              تحميل المزيد من المقالات
            </button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
