import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Users, Target, Eye, Award, MapPin, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "من نحن | جاهز",
  description: "تعرف على قصة جاهز، مهمتنا، رؤيتنا، وفريقنا المتميز.",
};

const VALUES = [
  {
    icon: Target,
    title: "مهمتنا",
    desc: "تسهيل وصول الطعام الشهي إلى كل منزل في فلسطين من خلال تقنية موثوقة وخدمة استثنائية.",
  },
  {
    icon: Eye,
    title: "رؤيتنا",
    desc: "أن نكون المنصة الرائدة في توصيل الطعام بالشرق الأوسط، ونموذجاً يُحتذى به في تجربة المستخدم.",
  },
  {
    icon: Award,
    title: "قيمنا",
    desc: "الشفافية، الجودة، السرعة، والاحترام — قيم راسخة تقود كل قرار نتخذه.",
  },
];

const MILESTONES = [
  { year: "2020", event: "تأسيس جاهز في غزة، فلسطين" },
  { year: "2021", event: "التوسع إلى 5 مدن فلسطينية" },
  { year: "2022", event: "تجاوز 500 مطعم شريك" },
  { year: "2023", event: "إطلاق برنامج نقاط المكافآت" },
  { year: "2024", event: "تجاوز مليون طلب ناجح" },
  { year: "2025", event: "أكثر من 1200 مطعم و800 سائق" },
];

const TEAM = [
  { name: "محمد الخطيب", role: "المدير التنفيذي والمؤسس", emoji: "👨‍💼" },
  { name: "سارة أبو علي", role: "مديرة العمليات", emoji: "👩‍💼" },
  { name: "يوسف حمدان", role: "رئيس قسم التقنية", emoji: "👨‍💻" },
  { name: "لينا نصر", role: "مديرة تجربة العملاء", emoji: "👩‍💻" },
];

export default function AboutPage() {
  return (
    <PageLayout>
      <PageHero
        badge="قصتنا"
        title="من نحن"
        description="جاهز هي منصة توصيل الطعام الرائدة في فلسطين، نربط بين أفضل المطاعم وملايين العملاء بتجربة سلسة وموثوقة."
      />

      {/* Mission / Vision / Values */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group text-center p-8 rounded-3xl border border-gray-100 hover:border-[#1f8a5b]/30 hover:shadow-[0_8px_32px_rgba(31,138,91,0.1)] transition-all duration-300"
              >
                <div className="w-16 h-16 bg-[#e6f2ec] rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:bg-[#1f8a5b] transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#1f8a5b] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#1f8a5b] font-bold text-sm uppercase tracking-widest">قصتنا</span>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2 mb-5 leading-tight">
                بدأنا بحلم بسيط،<br />وصنعنا فارقاً حقيقياً
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                في عام 2020، انطلقت جاهز من مطبخ صغير في غزة بفكرة واضحة: أن يحصل كل شخص على وجبته المفضلة في أسرع وقت وبأفضل تجربة ممكنة.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                بدأنا بعشرة مطاعم وثلاثة سائقين، واليوم نفخر بشبكة تضم أكثر من 1200 مطعم، 800 سائق، وملايين الطلبات الناجحة.
              </p>
              <p className="text-gray-600 leading-relaxed">
                نؤمن أن الطعام الجيد لا يجب أن يكون امتيازاً للبعض — بل حقٌّ لكل إنسان.
              </p>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute right-4 top-0 bottom-0 w-px bg-[#1f8a5b]/20" />
              <div className="flex flex-col gap-6">
                {MILESTONES.map(({ year, event }) => (
                  <div key={year} className="flex items-start gap-6 pr-10 relative">
                    <div className="absolute right-0 w-8 h-8 bg-[#1f8a5b] rounded-full flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(31,138,91,0.35)] -translate-x-0">
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                    </div>
                    <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 flex-1">
                      <span className="text-[#1f8a5b] font-black text-sm">{year}</span>
                      <p className="text-gray-700 font-semibold text-sm mt-0.5">{event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-16 gradient-orange">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: TrendingUp, value: "1M+", label: "طلب ناجح" },
              { icon: Users, value: "1200+", label: "مطعم شريك" },
              { icon: MapPin, value: "12", label: "مدينة فلسطينية" },
              { icon: Award, value: "4.8★", label: "متوسط التقييم" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-white">
                <Icon className="w-7 h-7 mx-auto mb-2 opacity-80" />
                <div className="text-3xl font-black">{value}</div>
                <div className="text-white/70 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[#1f8a5b] font-bold text-sm uppercase tracking-widest">فريقنا</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">
              الأشخاص خلف جاهز
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TEAM.map(({ name, role, emoji }) => (
              <div
                key={name}
                className="text-center p-6 rounded-3xl border border-gray-100 hover:border-[#1f8a5b]/30 hover:shadow-[0_8px_32px_rgba(31,138,91,0.1)] transition-all duration-300"
              >
                <div className="w-16 h-16 bg-[#e6f2ec] rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                  {emoji}
                </div>
                <h4 className="font-black text-gray-900 mb-1">{name}</h4>
                <p className="text-gray-500 text-sm">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
