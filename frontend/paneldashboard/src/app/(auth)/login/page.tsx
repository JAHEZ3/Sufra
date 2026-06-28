"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, Shield } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { usePublicStats } from "@/hooks/useAnalytics";
import { extractApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountUp } from "@/components/ui/count-up";
import { useToast } from "@/providers/ToastProvider";

// Marketing fallback values shown if the public stats endpoint is unreachable.
const FALLBACK_STATS = {
  restaurants: 1200,
  customers: 50_000,
  completedOrders: 200_000,
  uptimePercent: 99.9,
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { data: publicStats } = usePublicStats();
  const stats = publicStats ?? FALLBACK_STATS;
  const { success, error } = useToast();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      error("خطأ", "يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    login.mutate(
      { email: trimmedEmail, password },
      {
        onSuccess: () => success("مرحباً بك", "تم تسجيل الدخول بنجاح"),
        onError: (err) =>
          error(
            "فشل تسجيل الدخول",
            extractApiErrorMessage(err, "تأكد من بيانات الدخول وحاول مرة أخرى"),
          ),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white"
        style={{ background: "linear-gradient(135deg,#1e1e1e 0%,#2d2d2d 60%,#1d2c24 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center p-1 group cursor-pointer">
          <div className="bg-white/95 rounded-2xl p-1.5 transition-all duration-700 ease-out group-hover:bg-white group-hover:shadow-[0_10px_30px_rgba(31,138,91,0.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sufra-mark.png"
              alt="جاهز"
              width={56}
              height={56}
              className="object-contain transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-rotate-6"
            />
          </div>
          <div className="overflow-hidden max-w-0 group-hover:max-w-xs transition-[max-width] duration-700 ease-out">
            <div className="whitespace-nowrap ps-3 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out delay-200">
              <span className="text-3xl font-black block leading-none text-[#1f8a5b]">جاهز</span>
              <span className="text-xs text-white/50 flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3" /> لوحة الإدارة
              </span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-black leading-tight mb-4">
            إدارة كاملة
            <br />
            <span style={{ color: "#1f8a5b" }}>لكل المنصة</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            تحكم في المطاعم، المستخدمين، الطلبات، والإعدادات من مكان واحد
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              {
                key: "restaurants",
                label: "مطعم مسجّل",
                node: (
                  <CountUp
                    value={stats.restaurants}
                    prefix="+"
                    compact
                    decimals={0}
                  />
                ),
              },
              {
                key: "customers",
                label: "مستخدم نشط",
                node: (
                  <CountUp
                    value={stats.customers}
                    prefix="+"
                    compact
                    decimals={stats.customers >= 1000 ? 1 : 0}
                  />
                ),
              },
              {
                key: "orders",
                label: "طلب مكتمل",
                node: (
                  <CountUp
                    value={stats.completedOrders}
                    prefix="+"
                    compact
                    decimals={stats.completedOrders >= 1000 ? 1 : 0}
                  />
                ),
              },
              {
                key: "uptime",
                label: "وقت التشغيل",
                node: (
                  <CountUp
                    value={stats.uptimePercent}
                    suffix="%"
                    decimals={1}
                  />
                ),
              },
            ].map((s) => (
              <div
                key={s.key}
                className="bg-white/10 rounded-xl p-4 text-center backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors"
              >
                <p
                  className="text-3xl font-black tabular-nums"
                  style={{ color: "#1f8a5b" }}
                  dir="ltr"
                >
                  {s.node}
                </p>
                <p className="text-sm text-white/60 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-sm">© 2025 جاهز. جميع الحقوق محفوظة.</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="flex items-center mb-8 lg:hidden p-1 group cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sufra-mark.png"
              alt="جاهز"
              width={44}
              height={44}
              className="object-contain transition-all duration-700 ease-out group-hover:scale-110 group-hover:-rotate-6 group-hover:drop-shadow-[0_6px_16px_rgba(31,138,91,0.4)]"
            />
            <div className="overflow-hidden max-w-0 group-hover:max-w-xs transition-[max-width] duration-700 ease-out">
              <span className="block whitespace-nowrap ps-2.5 text-xl font-black text-[#1f8a5b] opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out delay-200">جاهز – لوحة الإدارة</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-md p-8">
            {/* Admin badge */}
            <div className="flex justify-center mb-6">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#1e1e1e,#2d2d2d)" }}
              >
                <Shield className="w-4 h-4" style={{ color: "#1f8a5b" }} />
                وصول المدير فقط
              </div>
            </div>

            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black text-foreground">تسجيل دخول المدير</h2>
              <p className="text-muted-foreground text-sm mt-1">
                أدخل بيانات حسابك للوصول إلى لوحة الإدارة
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="البريد الإلكتروني"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@jahaz.app"
                startIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
              />

              <Input
                label="كلمة المرور"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                startIcon={<Lock className="w-4 h-4" />}
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                autoComplete="current-password"
                required
              />

              <Button type="submit" className="w-full h-11" loading={login.isPending}>
                <Shield className="w-4 h-4" />
                تسجيل الدخول
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
