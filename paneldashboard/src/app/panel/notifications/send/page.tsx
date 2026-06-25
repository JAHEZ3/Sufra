"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Megaphone, Send, Phone, Users } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/hooks/useAuth";
import { useToast } from "@/providers/ToastProvider";
import { extractApiErrorMessage, notificationApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  BroadcastNotificationPayload,
  NotificationTargetRole,
  SendToPhonePayload,
} from "@/types/notification.types";

type Tab = "broadcast" | "phone";

const TYPE_DEFAULT = "admin.message";

const ROLES: { value: NotificationTargetRole | "all"; label: string }[] = [
  { value: "all", label: "كل المستخدمين" },
  { value: "customer", label: "العملاء" },
  { value: "restaurant_owner", label: "أصحاب المطاعم" },
  { value: "delivery", label: "مندوبو التوصيل" },
  { value: "manager", label: "المدراء" },
];

export default function SendNotificationPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const [tab, setTab] = useState<Tab>("broadcast");

  const canSend = me?.role === "admin" || me?.role === "manager";

  useEffect(() => {
    if (!meLoading && !canSend) router.replace("/panel/notifications");
  }, [meLoading, canSend, router]);

  if (meLoading || !canSend) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header title="إرسال إشعار" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="إرسال إشعار" subtitle="أرسل إشعاراً لجميع المستخدمين أو لرقم محدد" />

      <div className="p-6 space-y-5 animate-fade-in-up max-w-3xl">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
          {([
            { value: "broadcast" as const, label: "للجميع", icon: Megaphone },
            { value: "phone" as const, label: "إلى رقم", icon: Phone },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5",
                  tab === t.value
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "broadcast" ? <BroadcastForm /> : <PhoneForm />}
      </div>
    </div>
  );
}

function BroadcastForm() {
  const { success, error } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<NotificationTargetRole | "all">("all");

  const mutation = useMutation({
    mutationFn: (payload: BroadcastNotificationPayload) =>
      notificationApi.broadcast(payload),
    onSuccess: (res) => {
      const body = res.data as { data?: { recipients?: number }; recipients?: number };
      const recipients = body.data?.recipients ?? body.recipients ?? 0;
      success("تم الإرسال", `تم إرسال الإشعار إلى ${recipients} مستخدم.`);
      setTitle("");
      setBody("");
    },
    onError: (err) =>
      error("فشل الإرسال", extractApiErrorMessage(err, "تعذّر إرسال الإشعار")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      error("بيانات ناقصة", "يرجى إدخال العنوان.");
      return;
    }
    const payload: BroadcastNotificationPayload = {
      type: TYPE_DEFAULT,
      title: title.trim(),
      ...(body.trim() && { body: body.trim() }),
      ...(role !== "all" && { role }),
    };
    mutation.mutate(payload);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center gap-2 text-foreground">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold">إرسال للجميع</p>
          <p className="text-xs text-muted-foreground">
            يمكنك تخصيص الإرسال لفئة معينة من المستخدمين.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-sm font-medium text-foreground">الفئة المستهدفة</label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as NotificationTargetRole | "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="اختر الفئة" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Input
        label="العنوان"
        placeholder="عنوان الإشعار"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <Textarea
        label="نص الرسالة (اختياري)"
        placeholder="تفاصيل الإشعار..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
      />

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={mutation.isPending}>
          {!mutation.isPending && <Send className="w-4 h-4" />}
          إرسال الإشعار
        </Button>
      </div>
    </form>
  );
}

function PhoneForm() {
  const { success, error } = useToast();
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: SendToPhonePayload) =>
      notificationApi.sendToPhone(payload),
    onSuccess: () => {
      success("تم الإرسال", "تم إرسال الإشعار إلى المستخدم.");
      setTitle("");
      setBody("");
    },
    onError: (err) =>
      error("فشل الإرسال", extractApiErrorMessage(err, "تعذّر إرسال الإشعار")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      error("بيانات ناقصة", "يرجى إدخال رقم الجوال.");
      return;
    }
    if (!title.trim()) {
      error("بيانات ناقصة", "يرجى إدخال العنوان.");
      return;
    }
    mutation.mutate({
      phone: trimmedPhone,
      type: TYPE_DEFAULT,
      title: title.trim(),
      ...(body.trim() && { body: body.trim() }),
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center gap-2 text-foreground">
        <div className="w-9 h-9 rounded-xl bg-info-light text-info flex items-center justify-center">
          <Phone className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold">إرسال إلى رقم محدد</p>
          <p className="text-xs text-muted-foreground">
            أدخل رقم الجوال المسجَّل لدى المستخدم.
          </p>
        </div>
      </div>

      <Input
        label="رقم الجوال"
        placeholder="مثال: 9665XXXXXXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        autoComplete="off"
        dir="ltr"
      />

      <Input
        label="العنوان"
        placeholder="عنوان الإشعار"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <Textarea
        label="نص الرسالة (اختياري)"
        placeholder="تفاصيل الإشعار..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
      />

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={mutation.isPending}>
          {!mutation.isPending && <Send className="w-4 h-4" />}
          إرسال الإشعار
        </Button>
      </div>
    </form>
  );
}
