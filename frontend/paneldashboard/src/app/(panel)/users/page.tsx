"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Filter,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  Eye,
  Users,
  Store,
  Bike,
  User as UserIcon,
} from "lucide-react";
import {
  useChangeUserStatus,
  useDeleteUser,
  useUsers,
} from "@/hooks/useUsers";
import { extractApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";
import { UserRole, UserStatus, type User } from "@/types/user.types";
import { UserDetailsDialog } from "@/components/users/UserDetailsDialog";

// ── UI role filter ─────────────────────────────────────────
type RoleFilter = "all" | "restaurant" | "delivery" | "customer";

const roleFilterToBackend: Record<Exclude<RoleFilter, "all">, UserRole> = {
  restaurant: UserRole.RESTAURANT_OWNER,
  delivery: UserRole.DELIVERY,
  customer: UserRole.CUSTOMER,
};

const roleLabels: Record<RoleFilter, string> = {
  all: "الكل",
  restaurant: "المطاعم",
  delivery: "التوصيل",
  customer: "العملاء",
};

const roleIcons: Record<RoleFilter, React.ReactNode> = {
  all: <Users className="w-4 h-4" />,
  restaurant: <Store className="w-4 h-4" />,
  delivery: <Bike className="w-4 h-4" />,
  customer: <UserIcon className="w-4 h-4" />,
};

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

function statusBadgeVariant(status: UserStatus) {
  if (status === UserStatus.ACTIVE) return "success" as const;
  if (status === UserStatus.PENDING) return "warning" as const;
  if (status === UserStatus.BANNED) return "error" as const;
  return "error" as const;
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

export default function UsersPage() {
  const [activeRole, setActiveRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const { success, error } = useToast();

  const params = useMemo(
    () => ({
      role: activeRole === "all" ? undefined : roleFilterToBackend[activeRole],
      search: search.trim() || undefined,
      page: 1,
      limit: 50,
    }),
    [activeRole, search],
  );

  const { data, isLoading } = useUsers(params);
  const items: User[] = data?.items ?? [];
  const total = data?.total ?? items.length;

  const counts: Record<RoleFilter, number | null> = {
    all: activeRole === "all" ? total : null,
    restaurant: activeRole === "restaurant" ? total : null,
    delivery: activeRole === "delivery" ? total : null,
    customer: activeRole === "customer" ? total : null,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="المستخدمون" subtitle="إدارة جميع مستخدمي المنصة" />

      <div className="p-6 space-y-5 animate-fade-in-up">
        {/* Role filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(["all", "restaurant", "delivery", "customer"] as RoleFilter[]).map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                activeRole === role
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {roleIcons[role]}
              {roleLabels[role]}
              {counts[role] !== null && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeRole === role ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {counts[role]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="بحث بالاسم، البريد، أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="w-4 h-4" />}
            />
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
                  {["المستخدم", "الدور", "الهاتف", "تاريخ التسجيل", "الحالة", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-5 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      لا يوجد مستخدمون يطابقون البحث
                    </td>
                  </tr>
                ) : (
                  items.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      menuOpen={openMenuId === user.id}
                      onToggleMenu={() =>
                        setOpenMenuId(openMenuId === user.id ? null : user.id)
                      }
                      onCloseMenu={() => setOpenMenuId(null)}
                      onViewDetails={() => {
                        setDetailsUserId(user.id);
                        setOpenMenuId(null);
                      }}
                      onStatusChanged={(msg) => success(msg)}
                      onError={(err, fallback) =>
                        error("خطأ", extractApiErrorMessage(err, fallback))
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              عرض {items.length} من أصل {total} مستخدم
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                السابق
              </Button>
              <Button variant="outline" size="sm">
                التالي
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <UserDetailsDialog
        userId={detailsUserId}
        open={!!detailsUserId}
        onOpenChange={(open) => {
          if (!open) setDetailsUserId(null);
        }}
      />
    </div>
  );
}

interface UserRowProps {
  user: User;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onViewDetails: () => void;
  onStatusChanged: (message: string) => void;
  onError: (err: unknown, fallback: string) => void;
}

function UserRow({
  user,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onViewDetails,
  onStatusChanged,
  onError,
}: UserRowProps) {
  const changeStatus = useChangeUserStatus(user.id);
  const deleteUser = useDeleteUser();
  const displayName = user.fullName?.trim() || user.email || user.phone || "—";
  const isActive = user.status === UserStatus.ACTIVE;

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
            {user.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <Badge variant={roleBadgeVariant(user.role)}>{roleToLabel(user.role)}</Badge>
      </td>

      <td className="px-4 py-3 text-muted-foreground dir-ltr text-left">
        {user.phone ?? "—"}
      </td>

      <td className="px-4 py-3 text-muted-foreground text-xs">
        {formatDateTime(user.createdAt)}
      </td>

      <td className="px-4 py-3">
        <Badge variant={statusBadgeVariant(user.status)}>
          {statusLabel(user.status)}
        </Badge>
      </td>

      <td className="px-4 py-3 relative">
        <button
          onClick={onToggleMenu}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-10 z-20 bg-white rounded-xl border border-border shadow-lg py-1 w-44 animate-scale-in">
            <button
              onClick={onViewDetails}
              className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="w-4 h-4 text-info" />
              عرض التفاصيل
            </button>
            <button
              onClick={() =>
                changeStatus.mutate(
                  { status: isActive ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
                  {
                    onSuccess: () => {
                      onStatusChanged(isActive ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
                      onCloseMenu();
                    },
                    onError: (err) => onError(err, "تعذّر تغيير حالة المستخدم"),
                  },
                )
              }
              disabled={changeStatus.isPending}
              className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {isActive ? (
                <>
                  <UserX className="w-4 h-4 text-warning" /> إيقاف الحساب
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-success" /> تفعيل الحساب
                </>
              )}
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={() =>
                deleteUser.mutate(user.id, {
                  onSuccess: () => {
                    onStatusChanged("تم حذف المستخدم");
                    onCloseMenu();
                  },
                  onError: (err) => onError(err, "تعذّر حذف المستخدم"),
                })
              }
              disabled={deleteUser.isPending}
              className="flex items-center gap-2 px-3 py-2 w-full text-sm text-error hover:bg-error-light transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              حذف المستخدم
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
