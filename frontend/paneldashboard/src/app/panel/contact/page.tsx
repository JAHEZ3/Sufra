"use client";

import { useMemo, useState } from "react";
import {
  Mail,
  Phone,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import {
  useSupportTickets,
  useUpdateSupportTicketStatus,
} from "@/hooks/useSupport";
import { useToast } from "@/providers/ToastProvider";
import { extractApiErrorMessage } from "@/lib/api";
import type {
  SupportTicket,
  SupportTicketStatus,
  SupportTicketSubject,
} from "@/types/support.types";

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "جديدة",
  in_progress: "قيد المعالجة",
  resolved: "تم الحل",
  closed: "مُغلقة",
};

const STATUS_VARIANT: Record<
  SupportTicketStatus,
  "default" | "success" | "warning" | "error" | "info" | "muted"
> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "muted",
};

const SUBJECT_LABEL: Record<SupportTicketSubject, string> = {
  general: "استفسار عام",
  technical: "تقني",
  billing: "فواتير",
  partnership: "شراكة",
  order_issue: "مشكلة في طلب",
  restaurant_join: "الانضمام كمطعم",
  driver_join: "الانضمام كسائق",
  complaint: "شكوى أو اقتراح",
  other: "أخرى",
};

type StatusFilter = "all" | SupportTicketStatus;

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "open",
  "in_progress",
  "resolved",
  "closed",
];

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "الكل",
  ...STATUS_LABEL,
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function MessageDialog({
  ticket,
  onClose,
}: {
  ticket: SupportTicket | null;
  onClose: () => void;
}) {
  const open = !!ticket;
  const updateStatus = useUpdateSupportTicketStatus();
  const { success, error } = useToast();

  function changeStatus(status: SupportTicketStatus) {
    if (!ticket) return;
    updateStatus.mutate(
      { id: ticket.id, payload: { status } },
      {
        onSuccess: () => success("تم", "تم تحديث حالة الرسالة"),
        onError: (err) =>
          error("خطأ", extractApiErrorMessage(err, "تعذّر تحديث الحالة")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ticket?.title ?? "رسالة تواصل"}</DialogTitle>
          <DialogDescription>
            {ticket && formatDate(ticket.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5 max-h-[70vh] overflow-y-auto">
          {ticket && (
            <>
              {/* Sender info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 rounded-xl p-4">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    الاسم
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {ticket.submittedByName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    البريد
                  </p>
                  <a
                    href={`mailto:${ticket.submittedByEmail ?? ""}`}
                    className="text-sm font-medium text-primary hover:underline break-all"
                    dir="ltr"
                  >
                    {ticket.submittedByEmail ?? "—"}
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    الهاتف
                  </p>
                  {ticket.submittedByPhone ? (
                    <a
                      href={`tel:${ticket.submittedByPhone}`}
                      className="text-sm font-medium text-primary hover:underline"
                      dir="ltr"
                    >
                      {ticket.submittedByPhone}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {SUBJECT_LABEL[ticket.subject] ?? ticket.subject}
                </Badge>
                <Badge variant={STATUS_VARIANT[ticket.status]}>
                  {STATUS_LABEL[ticket.status]}
                </Badge>
              </div>

              {/* Message */}
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  الرسالة
                </p>
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {ticket.message}
                  </p>
                </div>
              </div>

              {/* Resolution note (if any) */}
              {ticket.resolutionNote && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    ملاحظة الفريق
                  </p>
                  <div className="bg-muted/40 border border-border rounded-xl p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {ticket.resolutionNote}
                    </p>
                  </div>
                </div>
              )}

              {/* Status actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {(Object.keys(STATUS_LABEL) as SupportTicketStatus[])
                  .filter((s) => s !== ticket.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={updateStatus.isPending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      نقل إلى: {STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function PanelContactPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const limit = 20;

  const { data, isLoading } = useSupportTickets({
    source: "contact_form",
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => {
      const haystack = [
        t.title,
        t.message,
        t.submittedByName,
        t.submittedByEmail,
        t.submittedByPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      open: items.filter((t) => t.status === "open").length,
      inProgress: items.filter((t) => t.status === "in_progress").length,
      resolved: items.filter((t) => t.status === "resolved").length,
    };
  }, [items]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="رسائل التواصل"
        subtitle="رسائل العملاء المرسلة من نموذج «اتصل بنا» على الموقع"
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            icon={<Mail className="w-5 h-5 text-primary" />}
            color="bg-primary/10"
            label="إجمالي الرسائل (الحالية)"
            value={counts.total}
          />
          <StatTile
            icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50"
            label="رسائل جديدة"
            value={counts.open}
          />
          <StatTile
            icon={<Clock className="w-5 h-5 text-indigo-600" />}
            color="bg-indigo-50"
            label="قيد المعالجة"
            value={counts.inProgress}
          />
          <StatTile
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            label="تم حلّها"
            value={counts.resolved}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="ابحث بالاسم، البريد، أو محتوى الرسالة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground border-border hover:bg-muted"
                }`}
              >
                {STATUS_FILTER_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  المُرسِل
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الموضوع
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الرسالة
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  التاريخ
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الحالة
                </th>
                <th className="px-5 py-3 text-xs font-bold text-muted-foreground">
                  الإجراء
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-5 py-4" colSpan={6}>
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    لا توجد رسائل مطابقة
                  </td>
                </tr>
              ) : (
                filteredItems.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(t)}
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {t.submittedByName ?? "—"}
                        </p>
                        <p
                          className="text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {t.submittedByEmail ?? ""}
                        </p>
                        {t.submittedByPhone && (
                          <p
                            className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3" />
                            {t.submittedByPhone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="default">
                        {SUBJECT_LABEL[t.subject] ?? t.subject}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 max-w-md">
                      <p className="text-sm text-foreground line-clamp-2">
                        {t.message}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_VARIANT[t.status]}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(t);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            >
              السابق
            </button>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {page} / {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      <MessageDialog
        ticket={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
