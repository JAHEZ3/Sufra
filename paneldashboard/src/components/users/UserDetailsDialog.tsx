"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/hooks/useUsers";
import { formatDateTime } from "@/lib/utils";
import { UserRole, UserStatus } from "@/types/user.types";

interface UserDetailsDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailsDialog({
  userId,
  open,
  onOpenChange,
}: UserDetailsDialogProps) {
  const { data: user, isLoading, isError } = useUser(open ? userId ?? undefined : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تفاصيل المستخدم</DialogTitle>
          <DialogDescription>معلومات الحساب والتحقق</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading || (!user && !isError) ? (
            <div className="space-y-3">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : isError || !user ? (
            <p className="text-sm text-error text-center py-8">
              تعذّر تحميل بيانات المستخدم.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Identity */}
              <div className="flex items-center gap-3 pb-4 border-b border-border/60">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
                >
                  {(user.fullName ?? user.email ?? user.phone ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">
                    {user.fullName ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {user.id}
                  </p>
                </div>
                <div className="mr-auto flex flex-col items-end gap-1.5">
                  <Badge variant={roleBadgeVariant(user.role)}>
                    {roleToLabel(user.role)}
                  </Badge>
                  <Badge variant={statusBadgeVariant(user.status)}>
                    {statusLabel(user.status)}
                  </Badge>
                </div>
              </div>

              {/* Fields */}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="البريد الإلكتروني" value={user.email} dir="ltr" />
                <Field label="رقم الهاتف" value={user.phone} dir="ltr" />
                <Field
                  label="تحقق البريد"
                  value={
                    user.emailVerifiedAt
                      ? formatDateTime(user.emailVerifiedAt)
                      : "غير متحقق"
                  }
                  tone={user.emailVerifiedAt ? "success" : "muted"}
                />
                <Field
                  label="تحقق الهاتف"
                  value={
                    user.phoneVerifiedAt
                      ? formatDateTime(user.phoneVerifiedAt)
                      : "غير متحقق"
                  }
                  tone={user.phoneVerifiedAt ? "success" : "muted"}
                />
                <Field
                  label="اكتمال الملف"
                  value={user.profileCompleted ? "مكتمل" : "غير مكتمل"}
                  tone={user.profileCompleted ? "success" : "warning"}
                />
                <Field
                  label="آخر دخول"
                  value={
                    user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "لا يوجد"
                  }
                />
                <Field
                  label="تاريخ التسجيل"
                  value={formatDateTime(user.createdAt)}
                />
              </dl>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string | null | undefined;
  dir?: "ltr" | "rtl";
  tone?: "muted" | "success" | "warning";
}

function Field({ label, value, dir, tone }: FieldProps) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground mb-0.5">{label}</dt>
      <dd
        className={`font-medium ${toneClass}`}
        style={dir ? { direction: dir, textAlign: dir === "ltr" ? "left" : "right" } : undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function roleToLabel(role: UserRole): string {
  switch (role) {
    case UserRole.RESTAURANT_OWNER:
      return "مطعم";
    case UserRole.DELIVERY:
      return "سائق توصيل";
    case UserRole.CUSTOMER:
      return "عميل";
    case UserRole.MANAGER:
      return "مدير";
  }
}

function roleBadgeVariant(role: UserRole) {
  if (role === UserRole.RESTAURANT_OWNER) return "default" as const;
  if (role === UserRole.DELIVERY) return "warning" as const;
  if (role === UserRole.MANAGER) return "error" as const;
  return "info" as const;
}

function statusLabel(status: UserStatus): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return "نشط";
    case UserStatus.PENDING:
      return "قيد التحقق";
    case UserStatus.SUSPENDED:
      return "موقوف";
    case UserStatus.BANNED:
      return "محظور";
  }
}

function statusBadgeVariant(status: UserStatus) {
  if (status === UserStatus.ACTIVE) return "success" as const;
  if (status === UserStatus.PENDING) return "warning" as const;
  return "error" as const;
}
