"use client";

import { useState } from "react";
import { Eye, EyeOff, Phone, Lock } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/providers/ToastProvider";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { error } = useToast();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone || !password) {
      error("خطأ", "يرجى إدخال رقم الجوال وكلمة المرور");
      return;
    }
    login.mutate(
      { phone, password },
      { onError: () => error("فشل تسجيل الدخول", "تأكد من بيانات الدخول وحاول مرة أخرى") },
    );
  };

  return (
    <AuthShell
      title={
        <>
          مرحباً بعودتك إلى <span className="text-primary">سفرة</span>
          <br />
          وأدِر طلباتك
        </>
      }
      subtitle="سجّل دخولك للوصول إلى لوحة التحكم وإدارة مطعمك من نظام نقاط بيع متكامل."
    >
      <div className="mb-6">
        <h2 className="text-[1.6rem] font-black leading-tight text-foreground">تسجيل الدخول</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">أدخل بياناتك للمتابعة</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="رقم الجوال *"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05xxxxxxxx"
          startIcon={<Phone className="w-4 h-4" />}
          autoComplete="tel"
          required
        />
        <div className="space-y-1.5">
          <Input
            label="كلمة المرور *"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            startIcon={<Lock className="w-4 h-4" />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end">
            <a href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              نسيت كلمة المرور؟
            </a>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full text-[15px]" loading={login.isPending}>
          تسجيل الدخول
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-muted-foreground">أو</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{" "}
        <a href="/register" className="font-bold text-primary hover:underline">
          إنشاء حساب جديد
        </a>
      </p>
    </AuthShell>
  );
}
