"use client";

import { useState, useRef, Suspense } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, ArrowRight, CheckCircle, ShieldCheck } from "lucide-react";
import { useResetPassword } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/providers/ToastProvider";
import { useSearchParams } from "next/navigation";

const DIGITS = 6;

const STRENGTH_CHECKS = [
  { label: "8 أحرف على الأقل", test: (p: string) => p.length >= 8 },
  { label: "حرف كبير (A-Z)",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "حرف صغير (a-z)",  test: (p: string) => /[a-z]/.test(p) },
  { label: "رقم (0-9)",        test: (p: string) => /\d/.test(p)   },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = STRENGTH_CHECKS.filter((c) => c.test(password)).length;
  const colors = ["bg-error", "bg-warning", "bg-warning", "bg-success"];
  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex gap-1">
        {STRENGTH_CHECKS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < passed ? colors[passed - 1] : "bg-border"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {STRENGTH_CHECKS.map((c) => {
          const ok = c.test(password);
          return (
            <div key={c.label} className="flex items-center gap-1.5">
              <CheckCircle className={`w-3 h-3 shrink-0 ${ok ? "text-success" : "text-muted-foreground/30"}`} />
              <span className={`text-[11px] ${ok ? "text-foreground" : "text-muted-foreground/50"}`}>{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [digits, setDigits]           = useState<string[]>(Array(DIGITS).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const resetPassword = useResetPassword();
  const { error, success } = useToast();

  const focusAt = (i: number) => inputs.current[i]?.focus();

  const handleDigitChange = (i: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < DIGITS - 1) focusAt(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) focusAt(i - 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGITS);
    const next = [...digits];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    focusAt(Math.min(pasted.length, DIGITS - 1));
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < DIGITS)         { error("خطأ", "يرجى إدخال رمز التحقق كاملاً"); return; }
    if (newPassword.length < 8)      { error("خطأ", "كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (newPassword !== confirmPwd)  { error("خطأ", "كلمة المرور وتأكيدها غير متطابقتين"); return; }

    resetPassword.mutate(
      { phone, otp, newPassword },
      {
        onSuccess: () => {
          success("تم بنجاح", "تم تعيين كلمة المرور الجديدة");
          window.location.replace("/login");
        },
        onError: () => error("فشل", "الرمز غير صحيح أو منتهي الصلاحية"),
      },
    );
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
            تعيين كلمة مرور جديدة
          </div>

          <h1 className="text-[2.6rem] font-black leading-[1.2] mb-4">
            أنشئ كلمة<br />
            <span className="text-primary">مرور قوية</span>
          </h1>
          <p className="text-white/55 text-[15px] leading-relaxed mb-10">
            أدخل رمز التحقق الذي أرسلناه إلى جوالك ثم عيّن
            كلمة مرور جديدة لحسابك.
          </p>

          {/* Tips */}
          <div className="mb-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">نصائح لكلمة مرور قوية</p>
            <div className="space-y-2.5">
              {[
                { icon: ShieldCheck, text: "استخدم 8 أحرف أو أكثر" },
                { icon: ShieldCheck, text: "اجمع بين أحرف كبيرة وصغيرة وأرقام" },
                { icon: ShieldCheck, text: "تجنب استخدام رقم جوالك أو تاريخ ميلادك" },
                { icon: ShieldCheck, text: "لا تعيد استخدام كلمات مرور قديمة" },
              ].map((t) => (
                <div key={t.text} className="flex items-center gap-2.5">
                  <t.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-sm text-white/55">{t.text}</p>
                </div>
              ))}
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

          <div className="mb-7">
            <h2 className="text-[1.75rem] font-black text-foreground leading-tight">تعيين كلمة مرور جديدة</h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              أُرسل رمز التحقق إلى{" "}
              <span className="font-bold text-foreground" style={{ direction: "ltr", unicodeBidi: "embed" }}>{phone}</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* OTP */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">رمز التحقق</p>
                <div className="flex gap-2 justify-center" style={{ direction: "ltr" }}>
                  {Array.from({ length: DIGITS }).map((_, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digits[i]}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      className={[
                        "w-11 h-12 text-center text-xl font-black rounded-xl border-2 transition-all bg-white focus:outline-none focus:ring-2 focus:ring-primary/20",
                        digits[i] ? "border-primary text-primary bg-primary/5" : "border-border text-foreground",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </div>

              {/* New password */}
              <div>
                <Input
                  label="كلمة المرور الجديدة"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  startIcon={<Lock className="w-4 h-4" />}
                  endIcon={
                    <button type="button" onClick={() => setShowNew(!showNew)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  autoComplete="new-password"
                  required
                />
                <PasswordStrength password={newPassword} />
              </div>

              {/* Confirm */}
              <Input
                label="تأكيد كلمة المرور"
                type={showConfirm ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                startIcon={<Lock className="w-4 h-4" />}
                endIcon={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={confirmPwd && newPassword !== confirmPwd ? "كلمة المرور غير متطابقة" : undefined}
                autoComplete="new-password"
                required
              />

              <Button type="submit" className="w-full h-11" loading={resetPassword.isPending}>
                تعيين كلمة المرور
              </Button>
            </form>

            <a
              href="/forgot-password"
              className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              إعادة إرسال الرمز
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
