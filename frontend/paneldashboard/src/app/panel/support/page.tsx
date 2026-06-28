"use client";

import { useState } from "react";
import {
  LifeBuoy,
  Phone,
  Mail,
  MessageCircle,
  MessagesSquare,
  Clock,
  ShieldCheck,
  Zap,
  ChevronDown,
  Send,
  BookOpen,
  FileText,
  Video,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/lib/api";
import { useCreateSupportTicket } from "@/hooks/useSupport";
import type {
  SupportTicketPriority,
  SupportTicketSubject,
} from "@/types/support.types";

function NativeSelect({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = props.id || label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={cn(
            "w-full h-10 rounded-lg border border-border bg-white px-3 pl-9 text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "transition-colors appearance-none cursor-pointer",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

const SUPPORT = {
  phone: "+966 55 000 0000",
  phoneTel: "+966550000000",
  email: "support@sufra.app",
  whatsapp: "+966550000000",
  hours: "يومياً من 9 صباحاً حتى 12 منتصف الليل",
  responseTime: "أقل من ساعة",
  uptime: "99.98%",
};

type Channel = {
  icon: typeof Phone;
  title: string;
  description: string;
  action: string;
  href: string;
  accent: { bg: string; fg: string; ring: string };
};

const channels: Channel[] = [
  {
    icon: Phone,
    title: "اتصال هاتفي",
    description: SUPPORT.phone,
    action: "اتصل الآن",
    href: `tel:${SUPPORT.phoneTel}`,
    accent: { bg: "bg-primary/10", fg: "text-primary", ring: "ring-primary/20" },
  },
  {
    icon: MessageCircle,
    title: "واتساب",
    description: "محادثة فورية مع الدعم",
    action: "افتح المحادثة",
    href: `https://wa.me/${SUPPORT.whatsapp.replace(/\D/g, "")}`,
    accent: { bg: "bg-success-light", fg: "text-success", ring: "ring-success/20" },
  },
  {
    icon: Mail,
    title: "البريد الإلكتروني",
    description: SUPPORT.email,
    action: "أرسل بريداً",
    href: `mailto:${SUPPORT.email}`,
    accent: { bg: "bg-info-light", fg: "text-info", ring: "ring-info/20" },
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "كيف أضيف مطعماً جديداً إلى المنصة؟",
    a: "من القائمة الجانبية اختر «المطاعم»، ثم اضغط زر «إضافة مطعم». املأ بيانات المطعم الأساسية، التصنيف، وساعات العمل. سيظهر المطعم للعملاء فور التفعيل.",
  },
  {
    q: "كيف يتم احتساب عمولات المنصة؟",
    a: "يتم احتساب العمولات تلقائياً على كل طلب مكتمل وفق النسبة المحددة في إعدادات المطعم. يمكنك مراجعة التفاصيل في صفحة الطلبات أو من ملف المطعم.",
  },
  {
    q: "ما المدة المتوقعة للرد على طلبات الدعم؟",
    a: `نلتزم بالرد خلال ${SUPPORT.responseTime} في ساعات العمل الرسمية. للحالات الحرجة المتعلقة بتعطل الخدمة يتم التصعيد فوراً للفريق التقني.`,
  },
  {
    q: "كيف أضيف مندوب توصيل جديد؟",
    a: "من صفحة «مندوبو التوصيل» اضغط «إضافة مندوب»، ثم أدخل بياناته ووثائقه. سيتم تفعيل حسابه بعد المراجعة وإرسال تعليمات الدخول له.",
  },
  {
    q: "هل يمكنني إرسال إشعارات جماعية للعملاء؟",
    a: "نعم. من صفحة «الإشعارات» اضغط «إرسال إشعار»، اختر الجمهور المستهدف (الكل أو رقم محدد)، ثم اكتب العنوان والمحتوى وأرسل.",
  },
  {
    q: "ماذا أفعل عند ملاحظة خلل تقني؟",
    a: "يرجى توثيق المشكلة بلقطة شاشة ورقم الطلب إن وجد، ثم التواصل عبر واتساب أو البريد الإلكتروني. سيتم فتح تذكرة دعم وإشعارك بالتحديثات.",
  },
];

const resources = [
  {
    icon: BookOpen,
    title: "دليل البدء السريع",
    description: "خطوات إعداد المنصة في أقل من 10 دقائق",
    href: "#",
  },
  {
    icon: FileText,
    title: "وثائق واجهة API",
    description: "مرجع شامل لمطوري التكاملات",
    href: "#",
  },
  {
    icon: Video,
    title: "شروحات بالفيديو",
    description: "مكتبة فيديوهات تغطي كافة الميزات",
    href: "#",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="مركز الدعم"
        subtitle="نحن هنا لمساعدتك — تواصل معنا في أي وقت"
      />

      <div className="p-6 space-y-6 animate-fade-in-up">
        <HeroBanner />
        <ChannelsGrid />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ContactForm />
            <FaqSection />
          </div>
          <div className="space-y-6">
            <SupportHoursCard />
            <ResourcesCard />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroBanner() {
  const stats = [
    { icon: Zap, label: "متوسط زمن الرد", value: SUPPORT.responseTime },
    { icon: ShieldCheck, label: "جاهزية النظام", value: SUPPORT.uptime },
    { icon: Clock, label: "ساعات الدعم", value: SUPPORT.hours },
  ];

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
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            فريق الدعم متاح الآن
          </div>
          <h2 className="text-2xl md:text-3xl font-black mb-2">
            كيف يمكننا مساعدتك اليوم؟
          </h2>
          <p className="text-white/90 text-sm md:text-base max-w-xl leading-relaxed">
            تواصل معنا عبر القنوات المتاحة أو أرسل رسالتك مباشرة وسنرد عليك في
            أقرب وقت. فريق متخصص جاهز لخدمتك على مدار الأسبوع.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 md:min-w-[420px]">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20"
            >
              <Icon className="w-4 h-4 mb-2 opacity-90" />
              <p className="text-[11px] text-white/80 leading-tight">{label}</p>
              <p className="text-sm font-bold mt-1 leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Channels ─────────────────────────────────────────────────────────────────

function ChannelsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {channels.map((c) => (
        <a
          key={c.title}
          href={c.href}
          target={c.href.startsWith("http") ? "_blank" : undefined}
          rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="group"
        >
          <Card className="p-5 h-full hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ring-4",
                  c.accent.bg,
                  c.accent.ring,
                )}
              >
                <c.icon className={cn("w-6 h-6", c.accent.fg)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">{c.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate" dir="ltr">
                  {c.description}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all",
                    c.accent.fg,
                  )}
                >
                  {c.action}
                  <ExternalLink className="w-3.5 h-3.5" />
                </p>
              </div>
            </div>
          </Card>
        </a>
      ))}
    </div>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

const SUBJECTS = [
  { value: "general", label: "استفسار عام" },
  { value: "technical", label: "مشكلة تقنية" },
  { value: "billing", label: "الفواتير والعمولات" },
  { value: "partnership", label: "شراكة وتعاون" },
  { value: "other", label: "أخرى" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "مرتفعة" },
  { value: "critical", label: "حرجة" },
];

function ContactForm() {
  const { success, error } = useToast();
  const create = useCreateSupportTicket();
  const [subject, setSubject] = useState<SupportTicketSubject>("general");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      error("بيانات ناقصة", "يرجى إدخال العنوان وتفاصيل الرسالة.");
      return;
    }

    create.mutate(
      {
        subject,
        priority,
        title: title.trim(),
        message: message.trim(),
      },
      {
        onSuccess: () => {
          success(
            "تم إرسال طلبك",
            "استلمنا رسالتك وسنعود إليك في أقرب وقت ممكن.",
          );
          setTitle("");
          setMessage("");
          setPriority("normal");
          setSubject("general");
        },
        onError: (err) =>
          error(
            "تعذّر الإرسال",
            extractApiErrorMessage(
              err,
              "يرجى المحاولة مجدداً أو استخدام قنوات الدعم الأخرى.",
            ),
          ),
      },
    );
  }

  return (
    <Card>
      <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessagesSquare className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">إرسال رسالة</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            صف مشكلتك أو استفسارك بالتفصيل وسنعود إليك في أقرب وقت.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NativeSelect
            label="نوع الطلب"
            value={subject}
            onChange={(e) =>
              setSubject(e.target.value as SupportTicketSubject)
            }
          >
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            label="الأولوية"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as SupportTicketPriority)
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <Input
          label="عنوان الرسالة"
          placeholder="ملخص قصير لطلبك"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />

        <Textarea
          label="تفاصيل الرسالة"
          placeholder="اكتب التفاصيل هنا. أرفق رقم الطلب أو أي معلومات تساعدنا على فهم المشكلة بسرعة."
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
        />

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            معلوماتك مشفّرة ولن تُشارك مع أطراف ثالثة.
          </p>
          <Button type="submit" loading={create.isPending}>
            <Send className="w-4 h-4" />
            إرسال الرسالة
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Card>
      <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-info-light text-info flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">الأسئلة الشائعة</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            إجابات سريعة لأكثر الأسئلة تكراراً.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {faqs.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full flex items-center gap-3 px-5 py-4 text-right hover:bg-muted/40 transition-colors"
                aria-expanded={isOpen}
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 transition-colors",
                    isOpen && "bg-primary/10 text-primary",
                  )}
                >
                  {isOpen ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground">
                  {item.q}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                    isOpen && "rotate-180 text-primary",
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-200",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 pr-[60px] text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Sidebar cards ────────────────────────────────────────────────────────────

function SupportHoursCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-success-light text-success flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">ساعات العمل</p>
          <p className="text-xs text-muted-foreground">المنطقة الزمنية: التوقيت السعودي</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <HoursRow day="الأحد - الخميس" hours="9 ص - 12 م" />
        <HoursRow day="الجمعة - السبت" hours="2 ظ - 12 م" />
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-success opacity-75 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-success" />
        </span>
        <p className="text-xs font-semibold text-success">الفريق متصل الآن</p>
      </div>
    </Card>
  );
}

function HoursRow({ day, hours }: { day: string; hours: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{day}</span>
      <span className="font-semibold text-foreground tabular-nums">{hours}</span>
    </div>
  );
}

function ResourcesCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">مصادر مساعدة</p>
          <p className="text-xs text-muted-foreground">أدلة وشروحات لتسريع عملك</p>
        </div>
      </div>

      <ul className="space-y-2">
        {resources.map((r) => (
          <li key={r.title}>
            <a
              href={r.href}
              className="flex items-center gap-3 p-3 -mx-1 rounded-xl hover:bg-muted/60 transition-colors group"
            >
              <span className="w-9 h-9 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                <r.icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground truncate">
                  {r.title}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {r.description}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90 group-hover:text-primary transition-colors" />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
