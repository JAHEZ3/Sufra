"use client";

import { useMemo, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHero } from "@/components/layout/PageHero";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  Send,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useContactInfo, useSubmitContact } from "@/hooks/useContact";
import type { ContactSubject } from "@/types/dto";

/** UI subject labels mapped to backend enum keys. */
const SUBJECT_OPTIONS: { value: ContactSubject; label: string }[] = [
  { value: "order_issue", label: "مشكلة في طلب" },
  { value: "restaurant_join", label: "الانضمام كمطعم" },
  { value: "driver_join", label: "الانضمام كسائق" },
  { value: "general", label: "استفسار عام" },
  { value: "complaint", label: "شكوى أو اقتراح" },
];

export default function ContactPage() {
  const { data: info } = useContactInfo();
  const submit = useSubmitContact();
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    subject: ContactSubject | "";
    message: string;
  }>({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactCards = useMemo(() => {
    return [
      {
        icon: Phone,
        title: "اتصل بنا",
        lines: [info?.supportPhone || "+970 59 000 0000"],
        note: "متاح للدعم",
        bg: "bg-[#e6f2ec]",
        color: "text-[#1f8a5b]",
      },
      {
        icon: Mail,
        title: "البريد الإلكتروني",
        lines: [info?.supportEmail || "support@sufra.ps"],
        note: "نرد خلال ساعة",
        bg: "bg-blue-50",
        color: "text-blue-600",
      },
      {
        icon: MapPin,
        title: "موقعنا",
        lines: (info?.supportAddress || "غزة، فلسطين").split("\n").filter(Boolean),
        note: "المقر الرئيسي",
        bg: "bg-green-50",
        color: "text-green-600",
      },
      {
        icon: Clock,
        title: "ساعات العمل",
        lines: (info?.supportHours || "السبت – الخميس\n8:00 ص – 11:00 م")
          .split("\n")
          .filter(Boolean),
        note: "دعم طوارئ 24/7",
        bg: "bg-purple-50",
        color: "text-purple-600",
      },
    ];
  }, [info]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.subject) {
      setError("يرجى اختيار الموضوع");
      return;
    }
    try {
      await submit.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: form.subject,
        title:
          SUBJECT_OPTIONS.find((s) => s.value === form.subject)?.label ??
          "تواصل من الموقع",
        message: form.message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الرسالة");
    }
  }

  const whatsappNumber = (info?.supportWhatsapp || "").replace(/[^0-9]/g, "");

  return (
    <PageLayout>
      <PageHero
        badge="تواصل معنا"
        title="اتصل بنا"
        description="فريقنا متاح دائماً لمساعدتك. أرسل رسالتك وسنرد عليك في أقرب وقت ممكن."
      />

      {/* Contact Info Cards */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactCards.map(({ icon: Icon, title, lines, note, bg, color }) => (
              <div key={title} className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow">
                <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-7 h-7 ${color}`} />
                </div>
                <h3 className="font-black text-gray-900 mb-2">{title}</h3>
                {lines.map((l) => (
                  <p key={l} className="text-gray-600 text-sm">{l}</p>
                ))}
                <span className={`inline-block mt-2 text-xs font-semibold ${color}`}>{note}</span>
              </div>
            ))}
          </div>

          {/* Form + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Form */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.08)] p-8">
              {sent ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">تم الإرسال!</h3>
                  <p className="text-gray-500">شكراً لتواصلك معنا. سنرد عليك في أقرب وقت ممكن.</p>
                  <button
                    onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}
                    className="mt-6 text-[#1f8a5b] font-bold hover:underline"
                  >
                    إرسال رسالة أخرى
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-7">
                    <div className="w-10 h-10 bg-[#e6f2ec] rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-[#1f8a5b]" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900">أرسل رسالتك</h3>
                      <p className="text-gray-400 text-sm">نرد خلال ساعة</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">الاسم الكامل *</label>
                        <input
                          required
                          minLength={2}
                          maxLength={200}
                          value={form.name}
                          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="محمد أحمد"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1f8a5b] focus:ring-2 focus:ring-[#1f8a5b]/20 outline-none text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">رقم الهاتف</label>
                        <input
                          value={form.phone}
                          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+970 59 ..."
                          dir="ltr"
                          maxLength={30}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1f8a5b] focus:ring-2 focus:ring-[#1f8a5b]/20 outline-none text-sm transition-all text-right"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">البريد الإلكتروني *</label>
                      <input
                        required
                        type="email"
                        maxLength={255}
                        value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="example@email.com"
                        dir="ltr"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1f8a5b] focus:ring-2 focus:ring-[#1f8a5b]/20 outline-none text-sm transition-all text-right"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">الموضوع *</label>
                      <select
                        required
                        value={form.subject}
                        onChange={e => setForm(p => ({ ...p, subject: e.target.value as ContactSubject }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1f8a5b] focus:ring-2 focus:ring-[#1f8a5b]/20 outline-none text-sm transition-all bg-white"
                      >
                        <option value="">اختر الموضوع</option>
                        {SUBJECT_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">الرسالة *</label>
                      <textarea
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={4}
                        value={form.message}
                        onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                        placeholder="اكتب رسالتك هنا..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1f8a5b] focus:ring-2 focus:ring-[#1f8a5b]/20 outline-none text-sm transition-all resize-none"
                      />
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submit.isPending}
                      className="w-full flex items-center justify-center gap-2 bg-[#1f8a5b] text-white font-black py-4 rounded-2xl hover:bg-[#176f49] transition-colors shadow-[0_8px_24px_rgba(31,138,91,0.35)] active:scale-[0.98] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submit.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      {submit.isPending ? "جارٍ الإرسال..." : "إرسال الرسالة"}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Map placeholder + WhatsApp */}
            <div className="flex flex-col gap-6">
              {/* Map */}
              <div className="flex-1 rounded-3xl overflow-hidden border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.08)] bg-gradient-to-br from-[#e6f2ec] to-[#d3ebe0] min-h-64 flex flex-col items-center justify-center gap-4">
                <span className="text-5xl">🗺️</span>
                <div className="text-center px-6">
                  {(info?.supportAddress || "غزة، فلسطين")
                    .split("\n")
                    .filter(Boolean)
                    .map((line, i) => (
                      <p
                        key={i}
                        className={
                          i === 0
                            ? "font-black text-gray-900 text-lg"
                            : "text-gray-500 text-sm"
                        }
                      >
                        {line}
                      </p>
                    ))}
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(info?.supportAddress || "غزة، فلسطين")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-[#1f8a5b] font-bold text-sm px-5 py-2.5 rounded-xl border border-[#1f8a5b]/20 hover:bg-[#e6f2ec] transition-colors"
                >
                  افتح في الخريطة
                </a>
              </div>

              {/* WhatsApp / social CTA */}
              {whatsappNumber && (
                <div className="bg-[#16201b] rounded-3xl p-6 text-white flex items-center gap-5">
                  <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-black text-base mb-1">واتساب — رد فوري</h4>
                    <p className="text-white/60 text-sm mb-3">تواصل معنا مباشرةً عبر واتساب</p>
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-500 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-green-600 transition-colors"
                    >
                      ابدأ المحادثة
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
