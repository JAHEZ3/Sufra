"use client";

import { useMemo, useState } from "react";
import {
  Search, Filter, Truck, Bike, Car, Footprints, Inbox, MapPin, Phone,
  Star, CheckCircle2, XCircle, FileText, Hash, Eye, User, Calendar,
  IdCard, Banknote, Wallet, ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useApproveDeliveryApplication,
  useChangeDeliveryAgentStatus,
  useDeliveryAgents,
  useDeliveryApplications,
  useRejectDeliveryApplication,
} from "@/hooks/useDeliveryAgents";
import { extractApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";
import {
  AgentStatus,
  VehicleType,
  type DeliveryAgent,
  type DeliveryApplication,
  type ListAgentsParams,
} from "@/types/delivery.types";

type Tab = "agents" | "applications";

const STATUS_OPTIONS: { value: AgentStatus | "all"; label: string }[] = [
  { value: "all",                            label: "كل الحالات" },
  { value: AgentStatus.ACTIVE,               label: "نشط" },
  { value: AgentStatus.PENDING_APPROVAL,     label: "قيد المراجعة" },
  { value: AgentStatus.SUSPENDED,            label: "موقوف" },
  { value: AgentStatus.OFFLINE,              label: "غير متصل" },
];

const VEHICLE_OPTIONS: { value: VehicleType | "all"; label: string }[] = [
  { value: "all",                  label: "كل المركبات" },
  { value: VehicleType.MOTORCYCLE, label: "دراجة نارية" },
  { value: VehicleType.BICYCLE,    label: "دراجة هوائية" },
  { value: VehicleType.CAR,        label: "سيارة" },
  { value: VehicleType.ON_FOOT,    label: "سيراً على الأقدام" },
];

const STATUS_VARIANT: Record<AgentStatus, "success" | "warning" | "error" | "muted"> = {
  [AgentStatus.ACTIVE]:           "success",
  [AgentStatus.PENDING_APPROVAL]: "warning",
  [AgentStatus.SUSPENDED]:        "error",
  [AgentStatus.OFFLINE]:          "muted",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  [AgentStatus.ACTIVE]:           "نشط",
  [AgentStatus.PENDING_APPROVAL]: "قيد المراجعة",
  [AgentStatus.SUSPENDED]:        "موقوف",
  [AgentStatus.OFFLINE]:          "غير متصل",
};

function vehicleIcon(t: VehicleType | null) {
  switch (t) {
    case VehicleType.MOTORCYCLE: return Truck;
    case VehicleType.BICYCLE:    return Bike;
    case VehicleType.CAR:        return Car;
    case VehicleType.ON_FOOT:    return Footprints;
    default:                     return Truck;
  }
}

export default function DeliveryAgentsPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const { data: applications } = useDeliveryApplications();
  const pendingCount = applications?.length ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="مندوبو التوصيل" subtitle="إدارة المندوبين ومراجعة طلبات الانضمام" />

      <div className="p-6 space-y-5 animate-fade-in-up">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { value: "agents" as const,       label: "المندوبون"      },
            { value: "applications" as const, label: "طلبات الانضمام" },
          ]).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                tab === t.value
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {t.label}
              {t.value === "applications" && pendingCount > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t.value ? "bg-white/20 text-white" : "bg-warning-light text-warning"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "agents" ? <AgentsList /> : <ApplicationsList />}
      </div>
    </div>
  );
}

// ─── Agents list ──────────────────────────────────────────────────────────────

function AgentsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AgentStatus | "all">("all");
  const [vehicleType, setVehicleType] = useState<VehicleType | "all">("all");
  const [city, setCity] = useState("");

  const params = useMemo<ListAgentsParams>(() => ({
    page: 1,
    limit: 50,
    ...(status !== "all" && { status }),
    ...(vehicleType !== "all" && { vehicleType }),
    ...(city.trim() && { city: city.trim() }),
    ...(search.trim() && { search: search.trim() }),
  }), [search, status, vehicleType, city]);

  const { data, isLoading } = useDeliveryAgents(params);
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-44">
          <Input
            placeholder="المدينة"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            startIcon={<MapPin className="w-4 h-4" />}
          />
        </div>
        <div className="w-44">
          <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="المركبة" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="md">
          <Filter className="w-4 h-4" />
          تصفية
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["المندوب", "المركبة", "الهاتف", "المدينة", "تقييم", "التوصيلات", "الحالة", "تفاصيل", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    لا يوجد مندوبون يطابقون البحث
                  </td>
                </tr>
              ) : (
                items.map((agent) => <AgentRow key={agent.id} agent={agent} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            عرض {items.length} من أصل {total} مندوب
          </p>
        </div>
      </Card>
    </>
  );
}

function AgentRow({ agent }: { agent: DeliveryAgent }) {
  const { success, error } = useToast();
  const change = useChangeDeliveryAgentStatus(agent.id);
  const Icon = vehicleIcon(agent.vehicleType);
  const displayName = agent.fullName?.trim() || `${agent.firstName} ${agent.lastName}`;
  const [detailsOpen, setDetailsOpen] = useState(false);

  function handleStatus(next: AgentStatus) {
    if (next === agent.status) return;
    change.mutate(
      { status: next },
      {
        onSuccess: () => success("تم الحفظ", "تم تحديث حالة المندوب."),
        onError: (err) => error("فشل التحديث", extractApiErrorMessage(err, "تعذّر تحديث الحالة")),
      },
    );
  }

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground">{displayName}</p>
            {agent.vehiclePlate && (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Hash className="w-3 h-3" /> {agent.vehiclePlate}
              </p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="text-xs">
            {VEHICLE_OPTIONS.find((v) => v.value === agent.vehicleType)?.label ?? "—"}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-muted-foreground" dir="ltr">
        {agent.phone ?? "—"}
      </td>

      <td className="px-4 py-3 text-muted-foreground">{agent.city ?? "—"}</td>

      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-xs">
          <Star className="w-3 h-3 text-warning" />
          {Number(agent.rating ?? 0).toFixed(1)}
        </span>
      </td>

      <td className="px-4 py-3 text-muted-foreground">
        {agent.totalDeliveries.toLocaleString("ar-SA")}
      </td>

      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[agent.status]}>{STATUS_LABEL[agent.status]}</Badge>
      </td>

      <td className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDetailsOpen(true)}
          aria-label="عرض تفاصيل المندوب"
        >
          <Eye className="w-4 h-4" />
          عرض
        </Button>
        <AgentDetailsDialog
          agent={agent}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </td>

      <td className="px-4 py-3 w-44">
        <Select
          value={agent.status}
          onValueChange={(v) => handleStatus(v as AgentStatus)}
          disabled={change.isPending}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[AgentStatus.ACTIVE, AgentStatus.SUSPENDED, AgentStatus.OFFLINE, AgentStatus.PENDING_APPROVAL].map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}

// ─── Agent details dialog ────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-b-0">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className="text-sm font-semibold text-foreground break-words"
          dir={dir}
        >
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

function AgentDetailsDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: DeliveryAgent;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const displayName = agent.fullName?.trim() || `${agent.firstName} ${agent.lastName}`;
  const vehicleLabel =
    VEHICLE_OPTIONS.find((v) => v.value === agent.vehicleType)?.label ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
              style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>{displayName}</DialogTitle>
              <DialogDescription>
                <Badge variant={STATUS_VARIANT[agent.status]}>
                  {STATUS_LABEL[agent.status]}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="grid gap-x-6 md:grid-cols-2">
          <DetailRow icon={User} label="الاسم الأول" value={agent.firstName} />
          <DetailRow icon={User} label="اسم العائلة" value={agent.lastName} />
          <DetailRow
            icon={Calendar}
            label="تاريخ الميلاد"
            value={agent.dateOfBirth ? formatDate(agent.dateOfBirth) : "—"}
          />
          <DetailRow
            icon={Phone}
            label="رقم الهاتف"
            value={agent.phone ?? "—"}
            dir="ltr"
          />
          <DetailRow
            icon={IdCard}
            label="رقم الهوية"
            value={agent.idNumber ?? "—"}
            dir="ltr"
          />
          <DetailRow icon={MapPin} label="المدينة" value={agent.city ?? "—"} />

          <DetailRow icon={vehicleIcon(agent.vehicleType)} label="نوع المركبة" value={vehicleLabel} />
          <DetailRow
            icon={Hash}
            label="لوحة المركبة"
            value={agent.vehiclePlate ?? "—"}
            dir="ltr"
          />
          <DetailRow
            icon={FileText}
            label="رقم رخصة المركبة"
            value={agent.vehicleLicenseNumber ?? "—"}
            dir="ltr"
          />

          <DetailRow
            icon={User}
            label="جهة الاتصال للطوارئ"
            value={agent.emergencyContactName ?? "—"}
          />
          <DetailRow
            icon={Phone}
            label="هاتف الطوارئ"
            value={agent.emergencyContactPhone ?? "—"}
            dir="ltr"
          />

          <DetailRow
            icon={Star}
            label="التقييم"
            value={
              <span className="inline-flex items-center gap-1">
                <Star className="w-3 h-3 text-warning" />
                {Number(agent.rating ?? 0).toFixed(1)}
              </span>
            }
          />
          <DetailRow
            icon={CheckCircle2}
            label="عدد التوصيلات"
            value={agent.totalDeliveries.toLocaleString("ar-SA")}
          />
          <DetailRow
            icon={Wallet}
            label="رصيد المحفظة"
            value={formatCurrency(agent.walletBalance ?? 0)}
          />
          <DetailRow
            icon={ShieldCheck}
            label="موافق على الشروط"
            value={agent.termsAccepted ? "نعم" : "لا"}
          />
          <DetailRow
            icon={Calendar}
            label="تاريخ التسجيل"
            value={formatDateTime(agent.createdAt)}
          />
          <DetailRow
            icon={Hash}
            label="معرّف المندوب"
            value={<span className="text-xs">{agent.id}</span>}
            dir="ltr"
          />

          {agent.paymentInfo && (
            <div className="md:col-span-2 mt-4">
              <p className="text-xs font-bold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" />
                معلومات الدفع
              </p>
              <div className="grid gap-x-6 md:grid-cols-2 bg-muted/30 rounded-xl px-4">
                <DetailRow
                  icon={User}
                  label="اسم صاحب الحساب"
                  value={agent.paymentInfo.accountHolder ?? "—"}
                />
                <DetailRow
                  icon={Banknote}
                  label="اسم البنك"
                  value={agent.paymentInfo.bankName ?? "—"}
                />
                <DetailRow
                  icon={Hash}
                  label="IBAN"
                  value={agent.paymentInfo.iban ?? "—"}
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── Applications ─────────────────────────────────────────────────────────────

function ApplicationsList() {
  const { data, isLoading } = useDeliveryApplications();
  const items = data ?? [];

  return (
    <Card>
      <div className="divide-y divide-border">
        {isLoading && items.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-12 rounded" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground">لا توجد طلبات قيد المراجعة.</p>
          </div>
        ) : (
          items.map((app) => <ApplicationRow key={app.requestId} application={app} />)
        )}
      </div>
    </Card>
  );
}

function ApplicationRow({ application }: { application: DeliveryApplication }) {
  const { success, error } = useToast();
  const approve = useApproveDeliveryApplication();
  const reject = useRejectDeliveryApplication();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const Icon = vehicleIcon(null);
  const displayName = application.fullName?.trim() || "مندوب";
  const isPending = approve.isPending || reject.isPending;

  function handleApprove() {
    approve.mutate(application.requestId, {
      onSuccess: () => success("تم القبول", "تم قبول طلب المندوب."),
      onError: (err) =>
        error("فشل القبول", extractApiErrorMessage(err, "تعذّر قبول الطلب")),
    });
  }

  function handleReject() {
    if (!reason.trim()) {
      error("سبب الرفض مطلوب", "يرجى توضيح سبب الرفض.");
      return;
    }
    reject.mutate(
      { id: application.requestId, payload: { reason: reason.trim() } },
      {
        onSuccess: () => {
          success("تم الرفض", "تم رفض طلب المندوب.");
          setRejectOpen(false);
          setReason("");
        },
        onError: (err) =>
          error("فشل الرفض", extractApiErrorMessage(err, "تعذّر رفض الطلب")),
      },
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-4">
        {application.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={application.profilePictureUrl}
            alt=""
            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-warning-light text-warning flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{displayName}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {application.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span dir="ltr">{application.phone}</span>
              </span>
            )}
            <span>{formatDateTime(application.submittedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleApprove}
            loading={approve.isPending}
            disabled={isPending}
          >
            <CheckCircle2 className="w-4 h-4" />
            قبول
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setRejectOpen((v) => !v)}
            disabled={isPending}
          >
            <XCircle className="w-4 h-4" />
            رفض
          </Button>
        </div>
      </div>

      {application.answers && application.answers.length > 0 && (
        <div className="pr-16 text-xs text-muted-foreground space-y-1">
          {application.answers.map((a, i) => (
            <div key={i} className="flex gap-2">
              <FileText className="w-3 h-3 mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold text-foreground">{a.question}</span>
                {" — "}
                {a.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {rejectOpen && (
        <div className="pr-16 space-y-2">
          <Textarea
            label="سبب الرفض"
            placeholder="اكتب سبب الرفض هنا..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setRejectOpen(false); setReason(""); }}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={reject.isPending}
            >
              تأكيد الرفض
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
