"use client";

import { useState } from "react";
import { Phone, CheckCircle, Store, Lock } from "lucide-react";
import { useRegister } from "@/hooks/useAuth";
import { getApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/providers/ToastProvider";

export default function RegisterPage() {
  const [restaurantName, setRestaurantName] = useState("");
  const [phone, setPhone]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirm, setConfirm]               = useState("");

  const register = useRegister();
  const { error } = useToast();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restaurantName.trim()) { error("خطأ", "يرجى إدخال اسم المطعم"); return; }
    if (!phone.trim())          { error("خطأ", "يرجى إدخال رقم الجوال"); return; }
    if (password.length < 8)    { error("خطأ", "كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== confirm)   { error("خطأ", "كلمتا المرور غير متطابقتين"); return; }

    register.mutate(
      { phone: phone.trim(), password, restaurantName: restaurantName.trim() },
      { onError: (err) => error("فشل التسجيل", getApiError(err)) },
    );
  };

  return (
    <AuthShell
      title={
        <>
          انضم إلى <span className="text-primary">سفرة</span>
          <br />
          وابدأ إدارة طلباتك
        </>
      }
      subtitle="أنشئ حسابك على منصة سفرة وأدِر مطعمك من نظام نقاط بيع متكامل خلال دقيقة واحدة."
    >
      <div className="mb-6">
        <h2 className="text-[1.6rem] font-black leading-tight text-foreground">إنشاء حساب مطعم</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">يُفعَّل حسابك فوراً — لا حاجة لرمز تحقق أو موافقة.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="اسم المطعم *"
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          placeholder="مطعم سفرة"
          startIcon={<Store className="w-4 h-4" />}
          required
        />
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
        <Input
          label="كلمة المرور *"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 أحرف على الأقل"
          startIcon={<Lock className="w-4 h-4" />}
          autoComplete="new-password"
          required
        />
        <Input
          label="تأكيد كلمة المرور *"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="أعد إدخال كلمة المرور"
          startIcon={<Lock className="w-4 h-4" />}
          autoComplete="new-password"
          required
        />
        <Button type="submit" className="h-11 w-full text-[15px]" loading={register.isPending}>
          إنشاء الحساب والدخول
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle className="h-3.5 w-3.5 text-success" />
        تفعيل فوري بعد التسجيل
      </div>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-muted-foreground">أو</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        لديك حساب بالفعل؟{" "}
        <a href="/login" className="font-bold text-primary hover:underline">
          تسجيل الدخول
        </a>
      </p>
    </AuthShell>
  );
}
