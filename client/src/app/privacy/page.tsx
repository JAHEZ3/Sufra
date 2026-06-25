import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import { Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | جاهز",
  description: "سياسة الخصوصية لمنصة جاهز — كيف نجمع بياناتك ونحميها.",
};

const SECTIONS = [
  {
    title: "1. المعلومات التي نجمعها",
    content: `نجمع المعلومات التي تقدمها لنا مباشرةً عند إنشاء حساب أو تقديم طلب، وتشمل:
• الاسم الكامل ورقم الهاتف والبريد الإلكتروني
• عنوان التوصيل وبيانات الدفع (مشفرة)
• سجل الطلبات والتفضيلات
• بيانات الجهاز والموقع الجغرافي (عند الإذن)`,
  },
  {
    title: "2. كيف نستخدم معلوماتك",
    content: `نستخدم بياناتك لأغراض محددة تشمل:
• معالجة طلباتك وإتمام عمليات التوصيل
• تحسين تجربتك وتخصيص المحتوى المعروض
• إرسال إشعارات حول طلباتك وعروضنا
• منع الاحتيال وضمان أمان المنصة
• الامتثال للمتطلبات القانونية`,
  },
  {
    title: "3. مشاركة المعلومات",
    content: `لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك المعلومات فقط مع:
• المطاعم الشريكة لمعالجة طلباتك
• شركاء التوصيل لإيصال طلبك
• مزودي خدمات الدفع بشكل مشفر
• الجهات القانونية عند الضرورة القانونية`,
  },
  {
    title: "4. حماية البيانات",
    content: `نطبق أعلى معايير الأمان لحماية بياناتك:
• تشفير SSL/TLS لجميع الاتصالات
• تشفير بيانات الدفع وفق معيار PCI-DSS
• تحديثات أمنية منتظمة للأنظمة
• صلاحيات وصول محدودة للموظفين`,
  },
  {
    title: "5. ملفات تعريف الارتباط (Cookies)",
    content: `نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتشمل:
• ملفات ضرورية للوظائف الأساسية
• ملفات تحليلية لفهم سلوك المستخدم
• ملفات تفضيلات لحفظ إعداداتك
يمكنك إدارة تفضيلاتك من إعدادات المتصفح.`,
  },
  {
    title: "6. حقوقك",
    content: `لك الحق في:
• الاطلاع على بياناتك الشخصية المحفوظة لدينا
• تصحيح أي بيانات غير دقيقة
• طلب حذف بياناتك (الحق في النسيان)
• الاعتراض على معالجة بياناتك لأغراض التسويق
• نقل بياناتك إلى منصة أخرى
للمطالبة بأي من هذه الحقوق، تواصل معنا عبر privacy@sufra.ps`,
  },
  {
    title: "7. الاحتفاظ بالبيانات",
    content: `نحتفظ ببياناتك طالما كان حسابك نشطاً أو لمدة تصل إلى 5 سنوات لأغراض قانونية ومحاسبية. بعد حذف الحساب، تُحذف البيانات الشخصية خلال 30 يوماً.`,
  },
  {
    title: "8. التواصل معنا",
    content: `لأي استفسار حول سياسة الخصوصية، تواصل معنا:
البريد الإلكتروني: privacy@sufra.ps
الهاتف: +970 59 000 0000
العنوان: غزة، فلسطين`,
  },
];

export default function PrivacyPage() {
  return (
    <PageLayout>
      <PageHero
        badge="قانوني"
        title="سياسة الخصوصية"
        description="خصوصيتك تهمنا. تعرف على كيفية جمع بياناتك وحمايتها واستخدامها."
      />

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Last updated */}
          <div className="flex items-center gap-3 bg-[#e6f2ec] border border-[#1f8a5b]/20 rounded-2xl px-6 py-4 mb-12">
            <Shield className="w-5 h-5 text-[#1f8a5b] shrink-0" />
            <p className="text-sm text-gray-600">
              <span className="font-bold text-gray-900">آخر تحديث:</span> 1 أبريل 2026
              &nbsp;·&nbsp;
              هذه السياسة سارية المفعول وتُطبَّق على جميع مستخدمي منصة جاهز.
            </p>
          </div>

          {/* Intro */}
          <p className="text-gray-600 leading-relaxed mb-12 text-base">
            تلتزم شركة جاهز بحماية خصوصيتك وأمان بياناتك الشخصية. توضح هذه السياسة كيفية جمعنا للمعلومات ومعالجتها وحفظها عند استخدامك لمنصتنا أو تطبيقنا. باستخدامك لجاهز، فإنك توافق على شروط هذه السياسة.
          </p>

          {/* Sections */}
          <div className="flex flex-col gap-8">
            {SECTIONS.map(({ title, content }) => (
              <div key={title} className="border border-gray-100 rounded-2xl p-7 hover:border-[#1f8a5b]/20 hover:shadow-[0_4px_20px_rgba(31,138,91,0.06)] transition-all duration-300">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-3">
                  <span className="w-2 h-6 bg-[#1f8a5b] rounded-full shrink-0" />
                  {title}
                </h3>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
