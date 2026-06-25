
"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings, Globe, Bell, Percent,
  Truck, CreditCard, Save, AlertTriangle,
  CheckCircle, Wrench, RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, unwrapManager } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────
interface SystemSettings {
  general: {
    platformName: string;
    supportEmail: string;
    supportPhone: string;
    supportWhatsapp: string | null;
    supportAddress: string | null;
    supportHours: string | null;
    defaultLanguage: string;
    currency: string;
  };
  fees: {
    restaurantCommission: number;
    deliveryFeeBase: number;
    deliveryFeePerKm: number;
    minOrderAmount: number;
    taxRate: number;
  };
  delivery: {
    maxDeliveryRadius: number;
    estimatedTimeMin: number;
    estimatedTimeMax: number;
    allowScheduledOrders: boolean;
  };
  notifications: {
    enableEmailNotifications: boolean;
    enableSmsNotifications: boolean;
    enablePushNotifications: boolean;
    orderUpdatesEnabled: boolean;
    marketingEnabled: boolean;
  };
  system: {
    maintenanceMode: boolean;
    allowNewRegistrations: boolean;
    allowNewRestaurants: boolean;
    requireRestaurantApproval: boolean;
    requireDriverApproval: boolean;
    enableRatings: boolean;
    enableReviews: boolean;
  };
  payment: {
    enableCreditCard: boolean;
    enableApplePay: boolean;
    enableCashOnDelivery: boolean;
    enableWallet: boolean;
    maxWalletBalance: number;
  };
}

const defaultSettings: SystemSettings = {
  general: {
    platformName: "جاهز",
    supportEmail: "support@jahaz.app",
    supportPhone: "920012345",
    supportWhatsapp: null,
    supportAddress: null,
    supportHours: null,
    defaultLanguage: "ar",
    currency: "ILS",
  },
  fees: {
    restaurantCommission: 15,
    deliveryFeeBase: 5,
    deliveryFeePerKm: 2,
    minOrderAmount: 20,
    taxRate: 15,
  },
  delivery: {
    maxDeliveryRadius: 15,
    estimatedTimeMin: 20,
    estimatedTimeMax: 45,
    allowScheduledOrders: true,
  },
  notifications: {
    enableEmailNotifications: true,
    enableSmsNotifications: true,
    enablePushNotifications: true,
    orderUpdatesEnabled: true,
    marketingEnabled: false,
  },
  system: {
    maintenanceMode: false,
    allowNewRegistrations: true,
    allowNewRestaurants: true,
    requireRestaurantApproval: true,
    requireDriverApproval: true,
    enableRatings: true,
    enableReviews: true,
  },
  payment: {
    enableCreditCard: true,
    enableApplePay: true,
    enableCashOnDelivery: true,
    enableWallet: true,
    maxWalletBalance: 500,
  },
};

// ── Section nav ───────────────────────────────────────────
const sections = [
  { key: "general",       label: "عام",              icon: Globe },
  { key: "fees",          label: "العمولات والرسوم",  icon: Percent },
  { key: "delivery",      label: "التوصيل",           icon: Truck },
  { key: "notifications", label: "الإشعارات",         icon: Bell },
  { key: "payment",       label: "الدفع",             icon: CreditCard },
  { key: "system",        label: "النظام",            icon: Settings },
] as const;

type SectionKey = typeof sections[number]["key"];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("general");
  const [local, setLocal] = useState<SystemSettings>(defaultSettings);
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { isLoading, data: remoteSettings } = useQuery<Partial<SystemSettings>>({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const res = await settingsApi.get();
      return unwrapManager<Partial<SystemSettings>>(res.data);
    },
    placeholderData: defaultSettings,
    retry: false,
  });

  // Sync remote data into local state once when it arrives. Merge per-section
  // against defaults so a missing/partial response never produces undefined.
  useEffect(() => {
    if (!remoteSettings) return;
    setLocal({
      general:       { ...defaultSettings.general,       ...(remoteSettings.general       ?? {}) },
      fees:          { ...defaultSettings.fees,          ...(remoteSettings.fees          ?? {}) },
      delivery:      { ...defaultSettings.delivery,      ...(remoteSettings.delivery      ?? {}) },
      notifications: { ...defaultSettings.notifications, ...(remoteSettings.notifications ?? {}) },
      system:        { ...defaultSettings.system,        ...(remoteSettings.system        ?? {}) },
      payment:       { ...defaultSettings.payment,       ...(remoteSettings.payment       ?? {}) },
    });
  }, [remoteSettings]);

  const save = useMutation({
    mutationFn: () => settingsApi.update(local),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings });
      success("تم الحفظ", "تم تحديث الإعدادات بنجاح");
    },
    onError: () => error("خطأ", "تعذّر حفظ الإعدادات"),
  });

  const set = <K extends keyof SystemSettings>(
    section: K,
    field: keyof SystemSettings[K],
    value: unknown
  ) => {
    setLocal((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="الإعدادات" subtitle="تحكم كامل في إعدادات المنصة" />

      <div className="p-6 animate-fade-in-up">
        <div className="flex gap-6">

          {/* Side nav */}
          <div className="w-52 shrink-0">
            <nav className="space-y-1 sticky top-20">
              {sections.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    activeSection === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-5">

            {/* ── General ───────────────────────────────── */}
            {activeSection === "general" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" /> الإعدادات العامة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <SettingsSkeleton /> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input label="اسم المنصة" value={local.general.platformName ?? ""}
                        onChange={(e) => set("general", "platformName", e.target.value)} />
                      <Input label="البريد الإلكتروني للدعم" value={local.general.supportEmail ?? ""}
                        onChange={(e) => set("general", "supportEmail", e.target.value)} />
                      <Input label="هاتف الدعم" value={local.general.supportPhone ?? ""}
                        onChange={(e) => set("general", "supportPhone", e.target.value)} />
                      <Input label="العملة الافتراضية" value={local.general.currency ?? ""}
                        onChange={(e) => set("general", "currency", e.target.value)} />

                      {/* ── Public contact info (shown on the website's "Contact us" page) ── */}
                      <div className="sm:col-span-2 mt-2 pt-5 border-t border-border">
                        <h3 className="text-sm font-bold text-foreground mb-1">
                          بيانات التواصل (تظهر على صفحة «اتصل بنا» في الموقع)
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          سيتم عرض هذه المعلومات للعملاء على الموقع العام. اتركها فارغة لإخفائها.
                        </p>
                      </div>
                      <Input
                        label="رقم واتساب"
                        placeholder="+970 59 000 0000"
                        dir="ltr"
                        value={local.general.supportWhatsapp ?? ""}
                        onChange={(e) =>
                          set("general", "supportWhatsapp", e.target.value || null)
                        }
                      />
                      <Input
                        label="ساعات العمل"
                        placeholder="السبت – الخميس، 8:00 ص – 11:00 م"
                        value={local.general.supportHours ?? ""}
                        onChange={(e) =>
                          set("general", "supportHours", e.target.value || null)
                        }
                      />
                      <div className="sm:col-span-2">
                        <Textarea
                          label="العنوان (يدعم أسطراً متعدّدة)"
                          rows={3}
                          placeholder={"غزة، فلسطين\nشارع الرشيد، المنطقة الغربية"}
                          value={local.general.supportAddress ?? ""}
                          onChange={(e) =>
                            set("general", "supportAddress", e.target.value || null)
                          }
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Fees ──────────────────────────────────── */}
            {activeSection === "fees" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-primary" /> العمولات والرسوم
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <SettingsSkeleton /> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <NumberInput
                        label="عمولة المطعم (%)"
                        value={local.fees.restaurantCommission}
                        onChange={(v) => set("fees", "restaurantCommission", v)}
                        min={0} max={50}
                      />
                      <NumberInput
                        label="رسوم التوصيل الأساسية (شيكل)"
                        value={local.fees.deliveryFeeBase}
                        onChange={(v) => set("fees", "deliveryFeeBase", v)}
                        min={0}
                      />
                      <NumberInput
                        label="رسوم التوصيل لكل كيلومتر (شيكل)"
                        value={local.fees.deliveryFeePerKm}
                        onChange={(v) => set("fees", "deliveryFeePerKm", v)}
                        min={0}
                      />
                      <NumberInput
                        label="الحد الأدنى للطلب (شيكل)"
                        value={local.fees.minOrderAmount}
                        onChange={(v) => set("fees", "minOrderAmount", v)}
                        min={0}
                      />
                      <NumberInput
                        label="نسبة ضريبة القيمة المضافة (%)"
                        value={local.fees.taxRate}
                        onChange={(v) => set("fees", "taxRate", v)}
                        min={0} max={30}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Delivery ──────────────────────────────── */}
            {activeSection === "delivery" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> إعدادات التوصيل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <SettingsSkeleton /> : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <NumberInput
                          label="أقصى نطاق توصيل (كم)"
                          value={local.delivery.maxDeliveryRadius}
                          onChange={(v) => set("delivery", "maxDeliveryRadius", v)}
                          min={1}
                        />
                        <NumberInput
                          label="أدنى وقت تسليم (دقيقة)"
                          value={local.delivery.estimatedTimeMin}
                          onChange={(v) => set("delivery", "estimatedTimeMin", v)}
                          min={5}
                        />
                        <NumberInput
                          label="أقصى وقت تسليم (دقيقة)"
                          value={local.delivery.estimatedTimeMax}
                          onChange={(v) => set("delivery", "estimatedTimeMax", v)}
                          min={10}
                        />
                      </div>
                      <SwitchRow
                        label="السماح بالطلبات المجدولة"
                        description="يتيح للعملاء تحديد وقت التسليم مسبقاً"
                        checked={local.delivery.allowScheduledOrders}
                        onChange={(v) => set("delivery", "allowScheduledOrders", v)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Notifications ─────────────────────────── */}
            {activeSection === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" /> الإشعارات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <SettingsSkeleton /> : (
                    <div className="space-y-4">
                      {([
                        { key: "enableEmailNotifications",  label: "إشعارات البريد الإلكتروني", desc: "إرسال إشعارات عبر البريد الإلكتروني" },
                        { key: "enableSmsNotifications",    label: "إشعارات الرسائل النصية",    desc: "إرسال رسائل SMS للمستخدمين" },
                        { key: "enablePushNotifications",   label: "الإشعارات الفورية",          desc: "إشعارات Push للتطبيق" },
                        { key: "orderUpdatesEnabled",       label: "تحديثات الطلبات",            desc: "إعلام المستخدمين بتغيير حالة طلباتهم" },
                        { key: "marketingEnabled",          label: "الإشعارات التسويقية",        desc: "إرسال عروض وإعلانات للمستخدمين" },
                      ] as const).map(({ key, label, desc }) => (
                        <SwitchRow
                          key={key}
                          label={label}
                          description={desc}
                          checked={local.notifications[key]}
                          onChange={(v) => set("notifications", key, v)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Payment ───────────────────────────────── */}
            {activeSection === "payment" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" /> طرق الدفع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <SettingsSkeleton /> : (
                    <div className="space-y-4">
                      {([
                        { key: "enableCreditCard",    label: "بطاقات الائتمان / مدى",    desc: "Visa, Mastercard, مدى" },
                        { key: "enableApplePay",      label: "Apple Pay",                 desc: "الدفع عبر Apple Pay" },
                        { key: "enableCashOnDelivery",label: "الدفع عند الاستلام",        desc: "نقداً عند التوصيل" },
                        { key: "enableWallet",        label: "المحفظة الإلكترونية",       desc: "رصيد داخل التطبيق" },
                      ] as const).map(({ key, label, desc }) => (
                        <SwitchRow
                          key={key}
                          label={label}
                          description={desc}
                          checked={local.payment[key]}
                          onChange={(v) => set("payment", key, v)}
                        />
                      ))}
                      <div className="pt-2">
                        <NumberInput
                          label="الحد الأقصى لرصيد المحفظة (شيكل)"
                          value={local.payment.maxWalletBalance}
                          onChange={(v) => set("payment", "maxWalletBalance", v)}
                          min={50}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── System ────────────────────────────────── */}
            {activeSection === "system" && (
              <div className="space-y-5">
                {/* Maintenance alert */}
                {local.system.maintenanceMode && (
                  <div className="flex items-center gap-3 bg-warning-light border border-warning/30 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">وضع الصيانة مفعّل</p>
                      <p className="text-xs text-amber-700">المنصة غير متاحة للمستخدمين حالياً</p>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" /> إعدادات النظام
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? <SettingsSkeleton /> : (
                      <div className="space-y-4">
                        <SwitchRow
                          label="وضع الصيانة"
                          description="إيقاف المنصة مؤقتاً لجميع المستخدمين"
                          checked={local.system.maintenanceMode}
                          onChange={(v) => set("system", "maintenanceMode", v)}
                          danger
                        />
                        <SwitchRow
                          label="السماح بتسجيلات جديدة"
                          description="يتيح للمستخدمين الجدد إنشاء حسابات"
                          checked={local.system.allowNewRegistrations}
                          onChange={(v) => set("system", "allowNewRegistrations", v)}
                        />
                        <SwitchRow
                          label="السماح بتسجيل مطاعم جديدة"
                          description="يتيح للمطاعم التقديم على المنصة"
                          checked={local.system.allowNewRestaurants}
                          onChange={(v) => set("system", "allowNewRestaurants", v)}
                        />
                        <SwitchRow
                          label="مراجعة المطاعم الجديدة"
                          description="تتطلب موافقة يدوية قبل نشر المطعم"
                          checked={local.system.requireRestaurantApproval}
                          onChange={(v) => set("system", "requireRestaurantApproval", v)}
                        />
                        <SwitchRow
                          label="مراجعة السائقين الجدد"
                          description="تتطلب موافقة يدوية قبل تفعيل السائق"
                          checked={local.system.requireDriverApproval}
                          onChange={(v) => set("system", "requireDriverApproval", v)}
                        />
                        <SwitchRow
                          label="تفعيل التقييمات"
                          description="يتيح للعملاء تقييم المطاعم والسائقين"
                          checked={local.system.enableRatings}
                          onChange={(v) => set("system", "enableRatings", v)}
                        />
                        <SwitchRow
                          label="تفعيل المراجعات"
                          description="يتيح للعملاء كتابة تعليقات"
                          checked={local.system.enableReviews}
                          onChange={(v) => set("system", "enableReviews", v)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* System info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-primary" /> معلومات النظام
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { label: "الإصدار",            value: "v2.4.1" },
                        { label: "بيئة التشغيل",       value: "Production" },
                        { label: "قاعدة البيانات",     value: <Badge variant="success"><CheckCircle className="w-3 h-3" /> متصلة</Badge> },
                        { label: "خدمة الرسائل",       value: <Badge variant="success"><CheckCircle className="w-3 h-3" /> نشطة</Badge> },
                        { label: "بوابة الدفع",        value: <Badge variant="success"><CheckCircle className="w-3 h-3" /> متصلة</Badge> },
                        { label: "آخر تحديث",          value: "15/04/2026" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/40 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate()} loading={save.isPending} size="lg">
                <Save className="w-4 h-4" />
                حفظ التغييرات
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <div>
        <p className={cn("text-sm font-semibold", danger && checked && "text-error")}>
          {label}
        </p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      label={label}
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" />
      ))}
    </div>
  );
}
