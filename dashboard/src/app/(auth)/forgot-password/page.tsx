"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone, ArrowRight, KeyRound, MessageSquare, Lock } from "lucide-react";
import { useForgotPassword } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/providers/ToastProvider";

const STEPS = [
  { icon: Phone,          label: "أدخل رقم جوالك المسجّل" },
  { icon: MessageSquare,  label: "استقبل رمز التحقق"       },
  { icon: Lock,           label: "عيّن كلمة مرور جديدة"   },
];

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const forgotPassword = useForgotPassword();
  const { error, success } = useToast();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone) { error("خطأ", "يرجى إدخال رقم الجوال"); return; }
    forgotPassword.mutate(phone, {
      onSuccess: () => {
        success("تم الإرسال", "تم إرسال رمز التحقق إلى جوالك");
        window.location.replace(`/reset-password?phone=${encodeURIComponent(phone)}`);
      },
      onError: () => error("فشل الإرسال", "تأكد من رقم الجوال وحاول مرة أخرى"),
    });
  };

  return (
    <div className="min-h-screen flex" dir="rtl">

      {/* ── Left dark panel ── */}
      <div className="hidden lg:flex flex-col w-[46%] bg-[#0f172a] p-12 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/30">ج</div>
          <span className="text-2xl font-black tracking-tight">جاهز</span>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/25 text-primary px-3 py-1.5 rounded-full text-xs font-bold mb-5 w-fit">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            استعادة كلمة المرور
          </div>

          <h1 className="text-[2.6rem] font-black leading-[1.2] mb-4">
            نسيت كلمة<br />
            <span className="text-primary">المرور؟</span>
          </h1>
          <p className="text-white/55 text-[15px] leading-relaxed mb-10">
            لا تقلق! سنرسل لك رمز تحقق على جوالك لإعادة
            تعيين كلمة المرور بسهولة وأمان.
          </p>

          {/* How it works */}
          <div className="mb-6">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">كيف يعمل؟</p>
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <s.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white/30">{i + 1}.</span>
                    <p className="text-sm text-white/65 font-medium">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-white/50 leading-relaxed">
                الرمز صالح لمدة 10 دقائق فقط. إذا لم تستلمه، تحقق من رقم جوالك وأعد المحاولة.
              </p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-white/25 text-xs">© 2025 جاهز. جميع الحقوق محفوظة.</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f8fafc]">
        <div className="w-full max-w-100">

          {/* Mobile logo */}
          <div className="flex items-center mb-8 lg:hidden p-1 group cursor-pointer">
            <Image
              src="/sufra-mark.png"
              alt="جاهز"
              width={48}
              height={48}
              priority
              unoptimized
              className="object-contain transition-all duration-700 ease-out group-hover:scale-125 group-hover:-rotate-6 group-hover:drop-shadow-[0_8px_20px_rgba(31,138,91,0.55)]"
            />
            <div className="overflow-hidden max-w-0 group-hover:max-w-xs transition-[max-width] duration-700 ease-out">
              <span className="block whitespace-nowrap ps-3 text-2xl font-black text-[#1f8a5b] opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out delay-200">جاهز</span>
            </div>
          </div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>

          <div className="mb-7">
            <h2 className="text-[1.75rem] font-black text-foreground leading-tight">نسيت كلمة المرور؟</h2>
            <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
              أدخل رقم جوالك المسجّل وسنرسل لك رمز التحقق على الفور
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm p-7 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="رقم الجوال"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                startIcon={<Phone className="w-4 h-4" />}
                autoComplete="tel"
                required
              />
              <Button type="submit" className="w-full h-11" loading={forgotPassword.isPending}>
                إرسال رمز التحقق
              </Button>
            </form>

            <a
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              العودة لتسجيل الدخول
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
