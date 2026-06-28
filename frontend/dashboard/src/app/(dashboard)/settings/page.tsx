"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/useCurrency";
import { CURRENCY_LIST } from "@/lib/currency";
import { useRestaurant, useUpdateRestaurant, useUpdateSettings, useUpdateBranding, useRestaurantHours, useSetHours } from "@/hooks/useRestaurant";
import { useSessions, useRevokeSession, useRevokeOtherSessions } from "@/hooks/useSessions";
import type { RestaurantHour } from "@/types/restaurant.types";
import type { SessionSummary } from "@/types/session.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectItem } from "@/components/ui/select";
import { useToast } from "@/providers/ToastProvider";
import { authApi, getApiError } from "@/lib/api";
import { Building2, Clock, Bell, Shield, ChevronLeft, Wallet, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PaymentMethodType, BankName, WalletType,
  type PaymentInfo,
} from "@/types/payment.types";
import { PaymentMethodIcon } from "@/components/ui/payment-icon";

const tabs = [
  { id: "restaurant", label: "بيانات المطعم",  icon: Building2 },
  { id: "branding",   label: "الهوية والألوان", icon: Palette   },
  { id: "hours",      label: "أوقات العمل",     icon: Clock     },
  { id: "payment",    label: "معلومات الدفع",  icon: Wallet    },
  { id: "notifications", label: "الإشعارات",   icon: Bell      },
  { id: "security",   label: "الأمان",           icon: Shield    },
] as const;

type Tab = typeof tabs[number]["id"];

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// Backend stores only (dayOfWeek, openTime, closeTime). We encode "closed"
// as openTime === closeTime === "00:00" so the round-trip is lossless.
const CLOSED_TIME = "00:00";

function buildDefaultHours(): RestaurantHour[] {
  return dayNames.map((_, i) => ({
    id: `default-${i}`,
    restaurantId: "",
    dayOfWeek: i,
    openTime: i === 0 ? CLOSED_TIME : "09:00",
    closeTime: i === 0 ? CLOSED_TIME : "23:00",
    isClosed: i === 0,
  }));
}

function normalizeHoursFromServer(rows: RestaurantHour[] | undefined): RestaurantHour[] {
  const byDay = new Map<number, RestaurantHour>();
  (rows ?? []).forEach((r) => byDay.set(r.dayOfWeek, r));
  const defaults = buildDefaultHours();
  return defaults.map((d) => {
    const found = byDay.get(d.dayOfWeek);
    if (!found) return d;
    const openTime = (found.openTime ?? "").slice(0, 5);
    const closeTime = (found.closeTime ?? "").slice(0, 5);
    return {
      ...found,
      openTime: openTime || d.openTime,
      closeTime: closeTime || d.closeTime,
      isClosed: openTime === CLOSED_TIME && closeTime === CLOSED_TIME,
    };
  });
}

function RestaurantSettingsTab() {
  const { data: restaurant, isLoading } = useRestaurant();
  const updateProfile = useUpdateRestaurant();
  const updateSettings = useUpdateSettings();
  const { success, error } = useToast();
  const { code: currencyCode, setCurrency } = useCurrency();
  const isSaving = updateProfile.isPending || updateSettings.isPending;

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    street: "",
    city: "",
    kitchenPrinterIp: "",
    kitchenPrinterPort: "",
    cashierPrinterIp: "",
    cashierPrinterPort: "",
  });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name ?? "",
        description: restaurant.description ?? "",
        phone: restaurant.phone ?? "",
        street: restaurant.street ?? "",
        city: restaurant.city ?? "",
        kitchenPrinterIp: restaurant.kitchenPrinterIp ?? "",
        kitchenPrinterPort: restaurant.kitchenPrinterPort?.toString() ?? "",
        cashierPrinterIp: restaurant.cashierPrinterIp ?? "",
        cashierPrinterPort: restaurant.cashierPrinterPort?.toString() ?? "",
      });
      // Keep the dashboard currency in sync with the server value.
      if (restaurant.currencyType && restaurant.currencyType !== currencyCode) {
        setCurrency(restaurant.currencyType as typeof currencyCode);
      }
    }
  }, [restaurant, currencyCode, setCurrency]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await Promise.all([
        updateProfile.mutateAsync({
          name: form.name,
          description: form.description,
          phone: form.phone,
          street: form.street,
          city: form.city,
        }),
        updateSettings.mutateAsync({
          currencyType: currencyCode,
          // Empty string clears the IP server-side (disables that printer).
          kitchenPrinterIp: form.kitchenPrinterIp.trim() || null,
          kitchenPrinterPort: parseInt(form.kitchenPrinterPort) || undefined,
          cashierPrinterIp: form.cashierPrinterIp.trim() || null,
          cashierPrinterPort: parseInt(form.cashierPrinterPort) || undefined,
        }),
      ]);
      success("تم حفظ البيانات");
    } catch {
      error("خطأ", "فشل حفظ البيانات");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-bold text-foreground">المعلومات الأساسية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="اسم المطعم *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثال: مطعم الأصالة"
            required
          />
          <Input
            label="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+966XXXXXXXXX"
            dir="ltr"
          />
        </div>
        <Textarea
          label="وصف المطعم"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="أكتب وصفاً مختصراً عن مطعمك..."
          rows={3}
        />
      </div>

      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-bold text-foreground">العنوان والتوصيل</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="المدينة"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="مثال: الرياض"
          />
          <Input
            label="العنوان التفصيلي"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            placeholder="الشارع، الحي"
          />
        </div>
      </div>

      {/* العملة — تُطبَّق على كل المبالغ في اللوحة وتُحفظ تلقائياً */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">العملة</h3>
          <p className="text-xs text-muted-foreground mt-1">
            العملة المعتمدة لعرض كل المبالغ في لوحة التحكم. يتم الحفظ فوراً.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CURRENCY_LIST.map((c) => {
            const active = c.code === currencyCode;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  updateSettings.mutate(
                    { currencyType: c.code },
                    {
                      onSuccess: () => success("تم تحديث العملة"),
                      onError: () => error("خطأ", "تعذّر حفظ العملة"),
                    },
                  );
                }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                  active
                    ? "border-primary bg-primary-light text-primary ring-2 ring-primary/20"
                    : "border-border bg-white text-foreground hover:border-primary/40"
                }`}
              >
                <span className="text-lg font-black">{c.symbol}</span>
                <span className="text-xs font-medium">{c.nameAr}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">الطابعات الحرارية</h3>
          <p className="text-xs text-muted-foreground mt-1">
            عناوين IP للطابعات على شبكة المطعم (ESC/POS عبر TCP). اتركها فارغة لتعطيل الطباعة التلقائية.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="IP طابعة المطبخ"
            value={form.kitchenPrinterIp}
            onChange={(e) => setForm({ ...form, kitchenPrinterIp: e.target.value })}
            placeholder="192.168.1.50"
            dir="ltr"
          />
          <Input
            label="منفذ طابعة المطبخ"
            type="number"
            value={form.kitchenPrinterPort}
            onChange={(e) => setForm({ ...form, kitchenPrinterPort: e.target.value })}
            placeholder="9100"
            dir="ltr"
          />
          <Input
            label="IP طابعة الكاشير"
            value={form.cashierPrinterIp}
            onChange={(e) => setForm({ ...form, cashierPrinterIp: e.target.value })}
            placeholder="192.168.1.51"
            dir="ltr"
          />
          <Input
            label="منفذ طابعة الكاشير"
            type="number"
            value={form.cashierPrinterPort}
            onChange={(e) => setForm({ ...form, cashierPrinterPort: e.target.value })}
            placeholder="9100"
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSaving} className="px-8">
          حفظ التغييرات
        </Button>
      </div>
    </form>
  );
}

function BrandingTab() {
  const { data: restaurant, isLoading } = useRestaurant();
  const update = useUpdateBranding();
  const { success, error } = useToast();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#1f8a5b");

  useEffect(() => {
    if (restaurant?.brandColor) setColor(restaurant.brandColor);
  }, [restaurant?.brandColor]);

  const pickLogo = (f: File | null) => { setLogoFile(f); setLogoPreview(f ? URL.createObjectURL(f) : null); };
  const pickCover = (f: File | null) => { setCoverFile(f); setCoverPreview(f ? URL.createObjectURL(f) : null); };

  const hex = /^#([0-9a-fA-F]{6})$/.test(color);
  const safe = hex ? color : "#1f8a5b";
  const PRESETS = ["#1f8a5b", "#0e7c66", "#c98a1e", "#b0463e", "#2a6fdb", "#9457c4", "#16201a"];
  const logoSrc = logoPreview ?? restaurant?.logoUrl ?? null;
  const coverSrc = coverPreview ?? restaurant?.coverUrl ?? null;

  const save = () => {
    if (!hex) { error("لون غير صالح", "استخدم الصيغة #RRGGBB"); return; }
    const fd = new FormData();
    fd.append("brandColor", color);
    if (logoFile) fd.append("logo", logoFile);
    if (coverFile) fd.append("cover", coverFile);
    update.mutate(fd, {
      onSuccess: () => { success("تم الحفظ", "تم تحديث هوية المطعم"); setLogoFile(null); setCoverFile(null); },
      onError: (e) => error("تعذر الحفظ", getApiError(e)),
    });
  };

  if (isLoading) {
    return <div className="bg-white rounded-xl border border-border p-6"><Skeleton className="h-44 w-full" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-base font-black text-foreground">الشعار وصورة الغلاف</h2>

        <div>
          <label className="text-sm font-semibold text-foreground">صورة الغلاف (خلفية منيو الزبون)</label>
          <div className="mt-2 relative h-36 rounded-2xl overflow-hidden border border-border bg-muted">
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">لا توجد صورة غلاف</div>
            )}
            <label className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-white/90 text-sm font-semibold cursor-pointer shadow-sm">
              تغيير الغلاف
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center text-2xl font-black text-muted-foreground">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="" className="w-full h-full object-cover" />
            ) : (restaurant?.name ?? "?").trim().charAt(0)}
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground">شعار المطعم</label>
            <div className="mt-2">
              <label className="inline-block px-3 py-1.5 rounded-lg border border-border bg-white text-sm font-semibold cursor-pointer">
                تغيير الشعار
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div>
          <h2 className="text-base font-black text-foreground">اللون الرئيسي</h2>
          <p className="text-sm text-muted-foreground mt-0.5">يظهر كلون مميّز في منيو الزبون عبر QR.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="color" value={safe} onChange={(e) => setColor(e.target.value)} className="w-12 h-12 rounded-lg border border-border cursor-pointer p-0" />
          <Input value={color} onChange={(e) => setColor(e.target.value)} dir="ltr" className="w-36 font-mono" />
          <div className="flex items-center gap-2">
            {PRESETS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} title={c} className="w-7 h-7 rounded-full border-2" style={{ background: c, borderColor: color.toLowerCase() === c.toLowerCase() ? "#16201a" : "transparent" }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">معاينة منيو الزبون</div>
          <div className="flex items-center justify-between bg-white rounded-xl border border-border p-3">
            <span className="font-bold" style={{ color: safe }}>34 ر.س</span>
            <button type="button" className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: safe }}>أضف للطلب</button>
          </div>
        </div>
      </div>

      <Button onClick={save} loading={update.isPending} className="w-full sm:w-auto">حفظ الهوية</Button>
    </div>
  );
}

function WorkingHoursTab() {
  const { data: hours, isLoading } = useRestaurantHours();
  const setHoursMutation = useSetHours();
  const { success, error } = useToast();

  const [localHours, setLocalHours] = useState<RestaurantHour[]>(() => buildDefaultHours());

  useEffect(() => {
    setLocalHours(normalizeHoursFromServer(hours));
  }, [hours]);

  const validate = (): string | null => {
    for (const h of localHours) {
      if (h.isClosed) continue;
      if (!/^\d{2}:\d{2}$/.test(h.openTime) || !/^\d{2}:\d{2}$/.test(h.closeTime)) {
        return `صيغة الوقت غير صحيحة ليوم ${dayNames[h.dayOfWeek]}`;
      }
      if (h.openTime === h.closeTime) {
        return `وقت الفتح والإغلاق متطابقان ليوم ${dayNames[h.dayOfWeek]}`;
      }
    }
    return null;
  };

  const handleSave = () => {
    const msg = validate();
    if (msg) {
      error("خطأ", msg);
      return;
    }
    const payload = localHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.isClosed ? CLOSED_TIME : h.openTime,
      closeTime: h.isClosed ? CLOSED_TIME : h.closeTime,
    }));
    setHoursMutation.mutate(payload, {
      onSuccess: () => success("تم حفظ أوقات العمل"),
      onError: () => error("خطأ", "فشل حفظ أوقات العمل"),
    });
  };

  const updateRow = (idx: number, patch: Partial<RestaurantHour>) => {
    setLocalHours((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">أوقات العمل الأسبوعية</h3>
          <p className="text-xs text-muted-foreground mt-0.5">حدد أوقات الفتح والإغلاق لكل يوم</p>
        </div>
        <div className="divide-y divide-border">
          {localHours.map((h, idx) => (
            <div key={h.dayOfWeek} className="flex items-center gap-4 px-5 py-4">
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold text-foreground">{dayNames[h.dayOfWeek]}</p>
              </div>
              <Switch
                checked={!h.isClosed}
                onCheckedChange={(v) => updateRow(idx, { isClosed: !v })}
              />
              <div className={cn("flex items-center gap-2 flex-1", h.isClosed && "opacity-40 pointer-events-none")}>
                <Input
                  type="time"
                  value={h.isClosed ? "09:00" : h.openTime}
                  onChange={(e) => updateRow(idx, { openTime: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">إلى</span>
                <Input
                  type="time"
                  value={h.isClosed ? "23:00" : h.closeTime}
                  onChange={(e) => updateRow(idx, { closeTime: e.target.value })}
                  className="w-32"
                />
              </div>
              {h.isClosed && (
                <span className="text-xs font-semibold text-error bg-error-light px-2 py-1 rounded-lg">
                  مغلق
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={setHoursMutation.isPending} className="px-8">
          حفظ أوقات العمل
        </Button>
      </div>
    </div>
  );
}

function PaymentInfoTab() {
  const { data: restaurant, isLoading } = useRestaurant();
  const updateSettings = useUpdateSettings();
  const { success, error } = useToast();

  const [type, setType] = useState<PaymentMethodType>(PaymentMethodType.BANK_ACCOUNT);
  const [bank, setBank] = useState({
    bankName: BankName.BANK_OF_PALESTINE as BankName,
    accountNumber: "",
    iban: "",
    bankPhone: "",
  });
  const [wallet, setWallet] = useState({
    walletType: WalletType.PALPAY as WalletType,
    accountNumber: "",
    phone: "",
  });

  useEffect(() => {
    const info = restaurant?.paymentInfo;
    if (!info) return;
    setType(info.type);
    if (info.type === PaymentMethodType.BANK_ACCOUNT) {
      setBank({
        bankName: info.bankName,
        accountNumber: info.accountNumber,
        iban: info.iban,
        bankPhone: info.bankPhone ?? "",
      });
    } else {
      setWallet({
        walletType: info.walletType,
        accountNumber: info.accountNumber,
        phone: info.phone,
      });
    }
  }, [restaurant?.paymentInfo]);

  const validate = (): { ok: true; payload: PaymentInfo } | { ok: false; msg: string } => {
    if (type === PaymentMethodType.BANK_ACCOUNT) {
      if (!bank.accountNumber.trim()) return { ok: false, msg: "رقم الحساب مطلوب" };
      if (!bank.iban.trim()) return { ok: false, msg: "رقم الـ IBAN مطلوب" };
      return {
        ok: true,
        payload: {
          type: PaymentMethodType.BANK_ACCOUNT,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber.trim(),
          iban: bank.iban.trim(),
          ...(bank.bankPhone.trim() ? { bankPhone: bank.bankPhone.trim() } : {}),
        },
      };
    }
    if (!wallet.accountNumber.trim()) return { ok: false, msg: "رقم الحساب مطلوب" };
    if (!wallet.phone.trim()) return { ok: false, msg: "رقم الهاتف مطلوب" };
    return {
      ok: true,
      payload: {
        type: PaymentMethodType.WALLET,
        walletType: wallet.walletType,
        accountNumber: wallet.accountNumber.trim(),
        phone: wallet.phone.trim(),
      },
    };
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = validate();
    if (!result.ok) {
      error("خطأ", result.msg);
      return;
    }
    try {
      await updateSettings.mutateAsync({ paymentInfo: result.payload });
      success("تم حفظ معلومات الدفع");
    } catch (err) {
      error("خطأ", getApiError(err));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">طريقة استلام المدفوعات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            تُستخدم هذه البيانات لتحويل أرباحك من الطلبات.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType(PaymentMethodType.BANK_ACCOUNT)}
            className={cn(
              "rounded-xl border p-4 text-right transition-all flex items-center gap-3",
              type === PaymentMethodType.BANK_ACCOUNT
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <PaymentMethodIcon
              type={PaymentMethodType.BANK_ACCOUNT}
              bank={bank.bankName}
              size={32}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">حساب بنكي</p>
              <p className="text-xs text-muted-foreground mt-1">
                تحويل بنكي إلى حسابك المحلي
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setType(PaymentMethodType.WALLET)}
            className={cn(
              "rounded-xl border p-4 text-right transition-all flex items-center gap-3",
              type === PaymentMethodType.WALLET
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <PaymentMethodIcon
              type={PaymentMethodType.WALLET}
              wallet={wallet.walletType}
              size={32}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">محفظة إلكترونية</p>
              <p className="text-xs text-muted-foreground mt-1">
                PalPay أو Jawwal Pay
              </p>
            </div>
          </button>
        </div>
      </div>

      {type === PaymentMethodType.BANK_ACCOUNT ? (
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">تفاصيل الحساب البنكي</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="البنك *"
              value={bank.bankName}
              onValueChange={(v) => setBank({ ...bank, bankName: v as BankName })}
            >
              {Object.values(BankName).map((b) => (
                <SelectItem key={b} value={b}>
                  <span className="inline-flex items-center gap-2">
                    <PaymentMethodIcon
                      type={PaymentMethodType.BANK_ACCOUNT}
                      bank={b}
                      size={18}
                    />
                    {b}
                  </span>
                </SelectItem>
              ))}
            </Select>
            <Input
              label="رقم الحساب *"
              value={bank.accountNumber}
              onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
              placeholder="123456789"
              dir="ltr"
              required
            />
            <Input
              label="IBAN *"
              value={bank.iban}
              onChange={(e) => setBank({ ...bank, iban: e.target.value })}
              placeholder="PSXXXXXXXXXXXXXXXXXXXXXX"
              dir="ltr"
              required
            />
            <Input
              label="هاتف البنك (اختياري)"
              value={bank.bankPhone}
              onChange={(e) => setBank({ ...bank, bankPhone: e.target.value })}
              placeholder="+970XXXXXXXXX"
              dir="ltr"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">تفاصيل المحفظة الإلكترونية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="نوع المحفظة *"
              value={wallet.walletType}
              onValueChange={(v) => setWallet({ ...wallet, walletType: v as WalletType })}
            >
              {Object.values(WalletType).map((w) => (
                <SelectItem key={w} value={w}>
                  <span className="inline-flex items-center gap-2">
                    <PaymentMethodIcon
                      type={PaymentMethodType.WALLET}
                      wallet={w}
                      size={18}
                    />
                    {w}
                  </span>
                </SelectItem>
              ))}
            </Select>
            <Input
              label="رقم الحساب *"
              value={wallet.accountNumber}
              onChange={(e) => setWallet({ ...wallet, accountNumber: e.target.value })}
              placeholder="رقم الحساب في المحفظة"
              dir="ltr"
              required
            />
            <Input
              label="رقم الهاتف *"
              value={wallet.phone}
              onChange={(e) => setWallet({ ...wallet, phone: e.target.value })}
              placeholder="+970XXXXXXXXX"
              dir="ltr"
              required
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={updateSettings.isPending} className="px-8">
          حفظ معلومات الدفع
        </Button>
      </div>
    </form>
  );
}

function NotificationsTab() {
  const [settings, setSettings] = useState({
    newOrders: true,
    orderStatus: true,
    lowStock: false,
    dailyReport: true,
    customerReviews: true,
    promotions: false,
  });

  const items = [
    { key: "newOrders",       label: "طلبات جديدة",    desc: "إشعار فوري عند ورود طلب جديد" },
    { key: "orderStatus",     label: "تحديث حالة الطلب", desc: "إشعار عند تغيير حالة الطلب" },
    { key: "lowStock",        label: "نفاد المخزون",    desc: "تنبيه عند نفاد وجبة معينة" },
    { key: "dailyReport",     label: "تقرير يومي",      desc: "ملخص يومي بالمبيعات والطلبات" },
    { key: "customerReviews", label: "تقييمات العملاء", desc: "إشعار عند وصول تقييم جديد" },
    { key: "promotions",      label: "العروض والتسويق", desc: "نصائح تسويقية ومقترحات" },
  ];

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">إعدادات الإشعارات</h3>
        <p className="text-xs text-muted-foreground mt-0.5">تحكم بالإشعارات التي تريد استقبالها</p>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
            <Switch
              checked={settings[item.key as keyof typeof settings]}
              onCheckedChange={(v) => setSettings({ ...settings, [item.key]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sessions helpers ──────────────────────────────────────────────────────

function formatSessionDevice(ua?: string): string {
  if (!ua) return "جهاز غير معروف";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? "Chrome" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" :
    "متصفح";
  const os =
    /Windows NT 10/i.test(ua) ? "Windows 10/11" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iOS/i.test(ua) ? "iOS" :
    /Linux/i.test(ua) ? "Linux" :
    "نظام غير معروف";
  return `${browser} — ${os}`;
}

function formatRelativeAr(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "الآن";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `منذ ${diffDay} يوم`;
  const diffMo = Math.round(diffDay / 30);
  return `منذ ${diffMo} شهر`;
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionSummary;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {formatSessionDevice(session.userAgent)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {session.ip ?? "IP غير معروف"} · {formatRelativeAr(session.lastUsedAt)}
        </p>
      </div>
      {session.current ? (
        <span className="text-xs font-bold text-success bg-success-light px-2.5 py-1 rounded-full shrink-0">
          الجلسة الحالية
        </span>
      ) : (
        <Button
          variant="danger"
          size="sm"
          loading={revoking}
          onClick={() => onRevoke(session.id)}
        >
          إنهاء
        </Button>
      )}
    </div>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const { success, error } = useToast();

  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      error("خطأ", "كلمتا المرور غير متطابقتين");
      return;
    }
    if (form.newPassword.length < 8) {
      error("خطأ", "كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    try {
      setPwLoading(true);
      await authApi.changePassword(form.currentPassword, form.newPassword);
      success("تم تغيير كلمة المرور بنجاح");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      error("خطأ", getApiError(err));
    } finally {
      setPwLoading(false);
    }
  };

  const handleRevokeOne = (id: string) => {
    setPendingRevoke(id);
    revokeOne.mutate(id, {
      onSuccess: () => success("تم إنهاء الجلسة"),
      onError: (err) => error("خطأ", getApiError(err)),
      onSettled: () => setPendingRevoke(null),
    });
  };

  const handleRevokeOthers = () => {
    revokeOthers.mutate(undefined, {
      onSuccess: (res) => {
        const revoked = (res.data?.data?.revoked ?? 0) as number;
        success(revoked > 0 ? `تم إنهاء ${revoked} جلسة` : "لا توجد جلسات أخرى");
      },
      onError: (err) => error("خطأ", getApiError(err)),
    });
  };

  const otherSessionsCount = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-bold text-foreground">تغيير كلمة المرور</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <Input
            label="كلمة المرور الحالية"
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
          />
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
          />
          <Input
            label="تأكيد كلمة المرور"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />
          <Button type="submit" loading={pwLoading}>تغيير كلمة المرور</Button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">جلسات الدخول</h3>
          {otherSessionsCount > 0 && (
            <Button
              variant="danger"
              size="sm"
              loading={revokeOthers.isPending}
              onClick={handleRevokeOthers}
            >
              إنهاء الجلسات الأخرى
            </Button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-muted rounded-xl" />)}
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            لا توجد جلسات نشطة
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={handleRevokeOne}
                revoking={pendingRevoke === session.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("restaurant");

  const tabContent: Record<Tab, React.ReactNode> = {
    restaurant:    <RestaurantSettingsTab />,
    branding:      <BrandingTab />,
    hours:         <WorkingHoursTab />,
    payment:       <PaymentInfoTab />,
    notifications: <NotificationsTab />,
    security:      <SecurityTab />,
  };

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-6 space-y-5">
        <div>
          <h1 className="text-xl font-black text-foreground">الإعدادات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة إعدادات حسابك ومطعمك</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar tabs */}
          <aside className="lg:w-52 shrink-0">
            <div className="bg-white rounded-xl border border-border p-2 space-y-1 lg:sticky lg:top-24">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    activeTab === id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-right">{label}</span>
                  {activeTab === id && <ChevronLeft className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </aside>

          {/* Tab content */}
          <div className="flex-1 min-w-0 animate-fade-in-up">
            {tabContent[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
