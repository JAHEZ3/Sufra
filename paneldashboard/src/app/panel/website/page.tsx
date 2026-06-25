"use client";

import { useEffect, useRef, useState } from "react";
import {
  Globe,
  Image as ImageIcon,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  Save,
  Upload,
  Loader2,
  ExternalLink,
  Sparkles,
  Eye,
  Inbox,
  ArrowLeft,
  Share2,
  Smartphone,
  Apple,
  Search,
  Link2,
  MousePointerClick,
  Store,
  Bike,
  Download,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { settingsApi, extractApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/providers/ToastProvider";
import { useSupportTickets } from "@/hooks/useSupport";
import type { ApiResponse } from "@/types/common.types";

// ─── Types (subset of SystemSettings — only the public-website-relevant section) ──

interface WebsiteSettings {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string | null;
  supportAddress: string | null;
  supportHours: string | null;
  defaultLanguage: string;
  currency: string;
  logoUrl: string | null;
  // Social media
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  snapchatUrl: string | null;
  // App stores
  appStoreUrl: string | null;
  googlePlayUrl: string | null;
  // Public website CTA button URLs
  restaurantSignupUrl: string | null;
  driverSignupUrl: string | null;
  appDownloadUrl: string | null;
  // SEO
  seoTitleTemplate: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
}

const DEFAULTS: WebsiteSettings = {
  platformName: "جاهز",
  supportEmail: "support@sufra.app",
  supportPhone: "+970 59 000 0000",
  supportWhatsapp: null,
  supportAddress: null,
  supportHours: null,
  defaultLanguage: "ar",
  currency: "ILS",
  logoUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  xUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
  snapchatUrl: null,
  appStoreUrl: null,
  googlePlayUrl: null,
  restaurantSignupUrl: null,
  driverSignupUrl: null,
  appDownloadUrl: null,
  seoTitleTemplate: null,
  seoDescription: null,
  seoOgImageUrl: null,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebsitePage() {
  const qc = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const res = await settingsApi.get();
      const body = res.data as ApiResponse<{ general: WebsiteSettings }> | { general: WebsiteSettings };
      const root = "data" in (body as object)
        ? (body as ApiResponse<{ general: WebsiteSettings }>).data
        : (body as { general: WebsiteSettings });
      return root.general;
    },
  });

  const [local, setLocal] = useState<WebsiteSettings>(DEFAULTS);

  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.update({ general: local }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings });
      success("تم الحفظ", "ظهرت التغييرات على الموقع العام.");
    },
    onError: (err) =>
      error("تعذّر الحفظ", extractApiErrorMessage(err, "يرجى المحاولة مجدداً.")),
  });

  function setField<K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="إدارة الموقع"
        subtitle="تحكم بالقيم التي تظهر للزوار على الموقع العام sufra.app"
      />

      <div className="p-6 space-y-6 animate-fade-in-up">
        <HeroBanner platformName={local.platformName} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <IdentityCard
              loading={isLoading}
              value={local}
              onChange={setField}
              onLogoUploaded={(url) => setField("logoUrl", url)}
            />
            <ContactInfoCard loading={isLoading} value={local} onChange={setField} />
            <SocialLinksCard loading={isLoading} value={local} onChange={setField} />
            <AppStoreLinksCard loading={isLoading} value={local} onChange={setField} />
            <CtaLinksCard loading={isLoading} value={local} onChange={setField} />
            <SeoCard loading={isLoading} value={local} onChange={setField} />

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                تظهر هذه القيم على الموقع خلال ٥ دقائق (ذاكرة تخزين مؤقتة).
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => data && setLocal(data)}
                  disabled={save.isPending || isLoading}
                >
                  إلغاء التغييرات
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
                  {save.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ التغييرات
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <LivePreviewCard value={local} />
            <RecentSubmissionsCard />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroBanner({ platformName }: { platformName: string }) {
  return (
    <Card
      className="relative overflow-hidden border-0 text-white"
      style={{ background: "linear-gradient(135deg,#1f8a5b 0%,#2fa06d 60%,#5cc295 100%)" }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white blur-2xl" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative p-7 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            محتوى الموقع العام
          </div>
          <h2 className="text-2xl md:text-3xl font-black mb-2">
            إدارة موقع {platformName || "جاهز"}
          </h2>
          <p className="text-white/90 text-sm md:text-base max-w-xl leading-relaxed">
            عدّل اسم المنصة، الشعار، وبيانات التواصل التي يراها الزوار على
            الفوتر وصفحة «اتصل بنا». التغييرات تنعكس تلقائياً على الموقع العام.
          </p>
        </div>

        <a
          href="https://sufra.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm shrink-0"
        >
          <Eye className="w-4 h-4" />
          فتح الموقع
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </Card>
  );
}

// ─── Identity (logo + brand) ──────────────────────────────────────────────────

function IdentityCard({
  loading,
  value,
  onChange,
  onLogoUploaded,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
  onLogoUploaded: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { success, error } = useToast();
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: (res) => {
      const body = res.data as ApiResponse<{ logoUrl: string | null }> | { logoUrl: string | null };
      const root = "data" in (body as object)
        ? (body as ApiResponse<{ logoUrl: string | null }>).data
        : (body as { logoUrl: string | null });
      onLogoUploaded(root.logoUrl ?? null);
      qc.invalidateQueries({ queryKey: queryKeys.settings });
      success("تم رفع الشعار", "تم تحديث شعار الموقع.");
    },
    onError: (err) =>
      error("تعذّر الرفع", extractApiErrorMessage(err, "يرجى المحاولة مجدداً.")),
  });

  function pickFile() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      error("ملف غير صالح", "الرجاء اختيار ملف صورة.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      error("الملف كبير", "الحد الأقصى ٥ ميجابايت.");
      return;
    }
    upload.mutate(f);
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> هوية الموقع
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-2xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                {value.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={value.logoUrl}
                    alt="شعار المنصة"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src="/sufra-mark.png"
                    alt="شعار افتراضي"
                    width={64}
                    height={64}
                    unoptimized
                    className="opacity-60"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">شعار المنصة</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG أو JPG، بحد أقصى ٥ ميجابايت. يظهر في رأس الموقع والفوتر.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={pickFile}
                  disabled={upload.isPending}
                >
                  {upload.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {value.logoUrl ? "استبدال الشعار" : "رفع شعار"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <Input
                label="اسم المنصة"
                placeholder="جاهز"
                value={value.platformName}
                onChange={(e) => onChange("platformName", e.target.value)}
              />
              <Input
                label="العملة الافتراضية"
                placeholder="ILS"
                dir="ltr"
                value={value.currency}
                onChange={(e) => onChange("currency", e.target.value.toUpperCase())}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Contact info card ────────────────────────────────────────────────────────

function ContactInfoCard({
  loading,
  value,
  onChange,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> بيانات التواصل الظاهرة على الموقع
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="هاتف الدعم"
              placeholder="+970 59 000 0000"
              dir="ltr"
              value={value.supportPhone}
              onChange={(e) => onChange("supportPhone", e.target.value)}
            />
            <Input
              label="البريد الإلكتروني"
              placeholder="support@sufra.app"
              dir="ltr"
              type="email"
              value={value.supportEmail}
              onChange={(e) => onChange("supportEmail", e.target.value)}
            />
            <Input
              label="رقم واتساب (اختياري)"
              placeholder="+970 59 000 0000"
              dir="ltr"
              value={value.supportWhatsapp ?? ""}
              onChange={(e) =>
                onChange("supportWhatsapp", e.target.value.trim() || null)
              }
            />
            <Input
              label="ساعات العمل (اختياري)"
              placeholder="السبت – الخميس، ٨ ص – ١١ م"
              value={value.supportHours ?? ""}
              onChange={(e) =>
                onChange("supportHours", e.target.value.trim() || null)
              }
            />
            <div className="sm:col-span-2">
              <Textarea
                label="العنوان (اختياري — يدعم أسطراً متعددة)"
                rows={3}
                placeholder={"غزة، فلسطين\nشارع الرشيد، المنطقة الغربية"}
                value={value.supportAddress ?? ""}
                onChange={(e) =>
                  onChange("supportAddress", e.target.value.trim() || null)
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreviewCard({ value }: { value: WebsiteSettings }) {
  const waNumber = value.supportWhatsapp?.replace(/\D/g, "") ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> معاينة مباشرة
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          هكذا تظهر بيانات التواصل في فوتر الموقع وصفحة «اتصل بنا».
        </p>

        <div className="bg-[#16201b] text-white rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3 text-white/80 text-sm">
            <Phone className="w-4 h-4 text-[#1f8a5b] shrink-0" />
            <span dir="ltr">{value.supportPhone || "—"}</span>
          </div>
          <div className="flex items-center gap-3 text-white/80 text-sm">
            <Mail className="w-4 h-4 text-[#1f8a5b] shrink-0" />
            <span dir="ltr">{value.supportEmail || "—"}</span>
          </div>
          {waNumber && (
            <div className="flex items-center gap-3 text-white/80 text-sm">
              <MessageCircle className="w-4 h-4 text-[#1f8a5b] shrink-0" />
              <span dir="ltr">{value.supportWhatsapp}</span>
            </div>
          )}
          {value.supportAddress && (
            <div className="flex items-start gap-3 text-white/80 text-sm">
              <MapPin className="w-4 h-4 text-[#1f8a5b] shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{value.supportAddress}</span>
            </div>
          )}
          {value.supportHours && (
            <div className="flex items-center gap-3 text-white/80 text-sm">
              <Clock className="w-4 h-4 text-[#1f8a5b] shrink-0" />
              <span>{value.supportHours}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-success" />
          </span>
          المعاينة تتحدث فورياً مع كل تعديل
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent submissions ───────────────────────────────────────────────────────

function RecentSubmissionsCard() {
  const { data, isLoading } = useSupportTickets({
    source: "contact_form",
    page: 1,
    limit: 5,
  });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between !pb-3">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" /> آخر الرسائل من الموقع
        </CardTitle>
        {data && data.total > 0 && (
          <Badge variant="muted" className="text-xs">
            {data.total}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((t) => (
              <li
                key={t.id}
                className="border border-border rounded-xl p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {t.submittedByName ?? t.submittedByEmail ?? "زائر"}
                    </p>
                  </div>
                  <Badge
                    variant={t.status === "open" ? "default" : "muted"}
                    className="text-[10px] shrink-0"
                  >
                    {t.status === "open" ? "جديدة" : "معالجة"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/panel/contact"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          عرض كل الرسائل
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Social media links card ──────────────────────────────────────────────────

const SOCIAL_FIELDS: {
  key: keyof Pick<
    WebsiteSettings,
    | "facebookUrl"
    | "instagramUrl"
    | "xUrl"
    | "youtubeUrl"
    | "tiktokUrl"
    | "snapchatUrl"
  >;
  label: string;
  placeholder: string;
}[] = [
  { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/sufra" },
  { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/sufra" },
  { key: "xUrl", label: "X (Twitter)", placeholder: "https://x.com/sufra" },
  { key: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/@sufra" },
  { key: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@sufra" },
  { key: "snapchatUrl", label: "Snapchat", placeholder: "https://snapchat.com/add/sufra" },
];

function SocialLinksCard({
  loading,
  value,
  onChange,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" /> روابط التواصل الاجتماعي
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          أدخل رابط الصفحة الكاملة. تظهر فقط الأيقونات التي تحتوي رابطاً غير فارغ
          في فوتر الموقع.
        </p>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
              <Input
                key={key}
                label={label}
                placeholder={placeholder}
                dir="ltr"
                startIcon={<Link2 className="w-4 h-4" />}
                value={value[key] ?? ""}
                onChange={(e) => onChange(key, e.target.value.trim() || null)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── App store links card ─────────────────────────────────────────────────────

function AppStoreLinksCard({
  loading,
  value,
  onChange,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" /> روابط متاجر التطبيقات
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          روابط تطبيق الجوال على المتجرين. تستبدل أزرار «حمّل من App Store /
          Google Play» في الموقع. اتركها فارغة لإخفاء الزر.
        </p>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="App Store (iOS)"
              placeholder="https://apps.apple.com/app/id..."
              dir="ltr"
              startIcon={<Apple className="w-4 h-4" />}
              value={value.appStoreUrl ?? ""}
              onChange={(e) => onChange("appStoreUrl", e.target.value.trim() || null)}
            />
            <Input
              label="Google Play (Android)"
              placeholder="https://play.google.com/store/apps/details?id=..."
              dir="ltr"
              startIcon={<Smartphone className="w-4 h-4" />}
              value={value.googlePlayUrl ?? ""}
              onChange={(e) => onChange("googlePlayUrl", e.target.value.trim() || null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CTA button URLs card ─────────────────────────────────────────────────────

function CtaLinksCard({
  loading,
  value,
  onChange,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-primary" /> روابط أزرار الدعوة (CTA)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          الوجهة التي ينتقل إليها الزائر عند الضغط على أزرار «سجّل مطعمك الآن»،
          «سجّل كسائق الآن»، و«حمّل التطبيق» الظاهرة في الموقع العام. اتركها
          فارغة لاستخدام السلوك الافتراضي (تمرير داخل الصفحة).
        </p>
        {loading ? (
          <div className="space-y-5">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            <Input
              label="زر «سجّل مطعمك الآن»"
              placeholder="https://partners.sufra.app/restaurant"
              dir="ltr"
              startIcon={<Store className="w-4 h-4" />}
              value={value.restaurantSignupUrl ?? ""}
              onChange={(e) =>
                onChange("restaurantSignupUrl", e.target.value.trim() || null)
              }
            />
            <Input
              label="زر «سجّل كسائق الآن»"
              placeholder="https://partners.sufra.app/driver"
              dir="ltr"
              startIcon={<Bike className="w-4 h-4" />}
              value={value.driverSignupUrl ?? ""}
              onChange={(e) =>
                onChange("driverSignupUrl", e.target.value.trim() || null)
              }
            />
            <Input
              label="زر «حمّل التطبيق»"
              placeholder="https://sufra.app/download"
              dir="ltr"
              startIcon={<Download className="w-4 h-4" />}
              value={value.appDownloadUrl ?? ""}
              onChange={(e) =>
                onChange("appDownloadUrl", e.target.value.trim() || null)
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SEO card ─────────────────────────────────────────────────────────────────

function SeoCard({
  loading,
  value,
  onChange,
}: {
  loading: boolean;
  value: WebsiteSettings;
  onChange: <K extends keyof WebsiteSettings>(key: K, v: WebsiteSettings[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> SEO ومشاركة الموقع
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          تظهر هذه القيم في نتائج البحث ومعاينة المشاركة على واتساب وتويتر
          وفيسبوك. استخدم{" "}
          <code className="bg-muted px-1 rounded text-[11px]">%s</code> داخل
          القالب ليُستبدل تلقائياً باسم الصفحة الحالية.
        </p>
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <Input
              label="قالب عنوان الصفحات"
              placeholder="%s | جاهز"
              dir="ltr"
              value={value.seoTitleTemplate ?? ""}
              onChange={(e) =>
                onChange("seoTitleTemplate", e.target.value || null)
              }
              maxLength={200}
            />
            <Textarea
              label="الوصف الافتراضي للموقع"
              rows={3}
              placeholder="أكبر منصة لتوصيل الطعام في فلسطين..."
              value={value.seoDescription ?? ""}
              onChange={(e) =>
                onChange("seoDescription", e.target.value || null)
              }
              maxLength={300}
            />
            <Input
              label="رابط صورة المعاينة (OG Image)"
              placeholder="https://...og-image.png"
              dir="ltr"
              startIcon={<Link2 className="w-4 h-4" />}
              value={value.seoOgImageUrl ?? ""}
              onChange={(e) =>
                onChange("seoOgImageUrl", e.target.value.trim() || null)
              }
            />
            {value.seoOgImageUrl && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/40">
                <p className="text-[11px] text-muted-foreground px-3 py-2 border-b border-border">
                  معاينة الصورة عند المشاركة
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.seoOgImageUrl}
                  alt=""
                  className="w-full max-h-48 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
