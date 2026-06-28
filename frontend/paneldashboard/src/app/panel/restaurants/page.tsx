"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, MoreVertical, CheckCircle,
  XCircle, Trash2, Eye, Pencil, Store, MapPin, Phone,
  Star, Ban, PlayCircle, BookOpen,
} from "lucide-react";
import {
  useRestaurantApplications,
  useRestaurants,
} from "@/hooks/useRestaurants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extractApiErrorMessage, restaurantsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";
import {
  CuisineType,
  Restaurant,
  RestaurantStatus,
} from "@/types/restaurant.types";
import { RestaurantDetailsDialog } from "@/components/restaurants/RestaurantDetailsDialog";
import { EditRestaurantDialog } from "@/components/restaurants/EditRestaurantDialog";
import { DeleteRestaurantDialog } from "@/components/restaurants/DeleteRestaurantDialog";
import { RestaurantMenuDialog } from "@/components/restaurants/RestaurantMenuDialog";
import { ApplicationsPanel } from "@/components/restaurants/ApplicationsPanel";
import {
  cuisineLabel,
  restaurantStatusBadgeVariant,
  restaurantStatusLabel,
} from "@/components/restaurants/restaurant-labels";

type FilterStatus = "all" | RestaurantStatus;
type Tab = "restaurants" | "applications";

const filterOrder: FilterStatus[] = [
  "all",
  RestaurantStatus.ACTIVE,
  RestaurantStatus.PENDING_APPROVAL,
  RestaurantStatus.SUSPENDED,
  RestaurantStatus.CLOSED,
];

const filterLabels: Record<FilterStatus, string> = {
  all: "الكل",
  ...restaurantStatusLabel,
};

export default function RestaurantsPage() {
  const [tab, setTab] = useState<Tab>("restaurants");
  const [activeStatus, setActiveStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { id: string; name: string | null } | null
  >(null);
  const qc = useQueryClient();
  const { success, error } = useToast();

  const params = useMemo(
    () => ({
      status: activeStatus === "all" ? undefined : activeStatus,
      search: search.trim() || undefined,
      page: 1,
      limit: 50,
    }),
    [activeStatus, search],
  );

  const { data, isLoading } = useRestaurants(params);
  const { data: applications } = useRestaurantApplications();

  const restaurants: Restaurant[] = data?.items ?? [];
  const total = data?.total ?? restaurants.length;
  const pendingApplications = applications?.length ?? 0;

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RestaurantStatus }) =>
      restaurantsApi.changeStatus(id, { status }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
      success(statusChangeMessage(vars.status));
      setOpenMenuId(null);
    },
    onError: (err) =>
      error("خطأ", extractApiErrorMessage(err, "تعذّر تحديث حالة المطعم")),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="المطاعم" subtitle="إدارة جميع المطاعم المسجّلة في المنصة" />

      <div className="p-6 space-y-5 animate-fade-in-up">

        {/* Top-level tabs */}
        <div className="flex gap-6 border-b border-border">
          <TabButton
            active={tab === "restaurants"}
            onClick={() => setTab("restaurants")}
            label="المطاعم"
            badge={tab === "restaurants" ? total : undefined}
          />
          <TabButton
            active={tab === "applications"}
            onClick={() => setTab("applications")}
            label="طلبات الانضمام"
            badge={pendingApplications || undefined}
            badgeTone="warning"
          />
        </div>

        {tab === "applications" ? (
          <ApplicationsPanel />
        ) : (
          <>
            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2">
              {filterOrder.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    activeStatus === s
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {filterLabels[s]}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="بحث بالاسم، المالك، أو المدينة..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  startIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4" />
                تصفية
              </Button>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-52 rounded-xl" />
                ))}
              </div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                لا توجد مطاعم تطابق البحث
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {restaurants.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    menuOpen={openMenuId === r.id}
                    onToggleMenu={() =>
                      setOpenMenuId(openMenuId === r.id ? null : r.id)
                    }
                    onCloseMenu={() => setOpenMenuId(null)}
                    onViewDetails={() => {
                      setDetailsId(r.id);
                      setOpenMenuId(null);
                    }}
                    onEdit={() => {
                      setEditId(r.id);
                      setOpenMenuId(null);
                    }}
                    onShowMenu={() => {
                      setMenuId(r.id);
                      setOpenMenuId(null);
                    }}
                    onDelete={() => {
                      setDeleteTarget({ id: r.id, name: r.name });
                      setOpenMenuId(null);
                    }}
                    onChangeStatus={(status) =>
                      changeStatus.mutate({ id: r.id, status })
                    }
                    statusChanging={
                      changeStatus.isPending && changeStatus.variables?.id === r.id
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <RestaurantDetailsDialog
        restaurantId={detailsId}
        open={!!detailsId}
        onOpenChange={(o) => {
          if (!o) setDetailsId(null);
        }}
      />
      <EditRestaurantDialog
        restaurantId={editId}
        open={!!editId}
        onOpenChange={(o) => {
          if (!o) setEditId(null);
        }}
      />
      <RestaurantMenuDialog
        restaurantId={menuId}
        open={!!menuId}
        onOpenChange={(o) => {
          if (!o) setMenuId(null);
        }}
      />
      <DeleteRestaurantDialog
        restaurantId={deleteTarget?.id ?? null}
        restaurantName={deleteTarget?.name ?? null}
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function statusChangeMessage(status: RestaurantStatus): string {
  switch (status) {
    case RestaurantStatus.ACTIVE:
      return "تم تفعيل المطعم";
    case RestaurantStatus.SUSPENDED:
      return "تم إيقاف المطعم";
    case RestaurantStatus.CLOSED:
      return "تم إغلاق المطعم";
    case RestaurantStatus.PENDING_APPROVAL:
      return "تم تحويل المطعم إلى انتظار المراجعة";
  }
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  badgeTone?: "default" | "warning";
}

function TabButton({ active, onClick, label, badge, badgeTone = "default" }: TabButtonProps) {
  const badgeClass =
    badgeTone === "warning"
      ? "bg-warning-light text-amber-800"
      : active
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${badgeClass}`}>
          {badge}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
      )}
    </button>
  );
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onShowMenu: () => void;
  onDelete: () => void;
  onChangeStatus: (status: RestaurantStatus) => void;
  statusChanging: boolean;
}

function RestaurantCard({
  restaurant: r,
  menuOpen,
  onToggleMenu,
  onViewDetails,
  onEdit,
  onShowMenu,
  onDelete,
  onChangeStatus,
  statusChanging,
}: RestaurantCardProps) {
  const rating = Number(r.rating ?? 0);
  const hasRating = Number.isFinite(rating) && rating > 0;

  return (
    <div className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
            style={{ background: "linear-gradient(135deg,#1f8a5b,#2fa06d)" }}
          >
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm truncate">
              {r.name ?? "مطعم بلا اسم"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {r.cuisineType ? cuisineLabel[r.cuisineType as CuisineType] : "—"}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={onToggleMenu}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-9 z-20 bg-white rounded-xl border border-border shadow-lg py-1 w-48 animate-scale-in">
              <MenuItem icon={<Eye className="w-4 h-4 text-info" />} onClick={onViewDetails}>
                عرض التفاصيل
              </MenuItem>
              <MenuItem icon={<BookOpen className="w-4 h-4 text-primary" />} onClick={onShowMenu}>
                عرض القائمة
              </MenuItem>
              <MenuItem icon={<Pencil className="w-4 h-4 text-muted-foreground" />} onClick={onEdit}>
                تعديل
              </MenuItem>

              <div className="border-t border-border my-1" />

              {r.status !== RestaurantStatus.ACTIVE && (
                <MenuItem
                  icon={<CheckCircle className="w-4 h-4 text-success" />}
                  onClick={() => onChangeStatus(RestaurantStatus.ACTIVE)}
                  disabled={statusChanging}
                >
                  {r.status === RestaurantStatus.PENDING_APPROVAL
                    ? "موافقة"
                    : "تفعيل"}
                </MenuItem>
              )}
              {r.status === RestaurantStatus.ACTIVE && (
                <MenuItem
                  icon={<XCircle className="w-4 h-4 text-warning" />}
                  onClick={() => onChangeStatus(RestaurantStatus.SUSPENDED)}
                  disabled={statusChanging}
                >
                  إيقاف مؤقت
                </MenuItem>
              )}
              {r.status !== RestaurantStatus.CLOSED && (
                <MenuItem
                  icon={<Ban className="w-4 h-4 text-error" />}
                  onClick={() => onChangeStatus(RestaurantStatus.CLOSED)}
                  disabled={statusChanging}
                >
                  إغلاق المطعم
                </MenuItem>
              )}
              {r.status === RestaurantStatus.CLOSED && (
                <MenuItem
                  icon={<PlayCircle className="w-4 h-4 text-success" />}
                  onClick={() => onChangeStatus(RestaurantStatus.ACTIVE)}
                  disabled={statusChanging}
                >
                  إعادة الفتح
                </MenuItem>
              )}

              <div className="border-t border-border my-1" />
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-3 py-2 w-full text-sm text-error hover:bg-error-light"
              >
                <Trash2 className="w-4 h-4" /> حذف
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="w-3.5 h-3.5" />
          {r.ownerName ?? "—"} – {r.phone ?? "—"}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          {r.city ?? "—"}
        </div>
        {hasRating && (
          <div className="flex items-center gap-1.5 text-xs text-warning font-semibold">
            <Star className="w-3.5 h-3.5 fill-warning" />
            {rating.toFixed(1)}
            <span className="text-muted-foreground font-normal">
              ({r.totalRatings})
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Badge variant={restaurantStatusBadgeVariant(r.status)}>
          {restaurantStatusLabel[r.status]}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatDateTime(r.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function MenuItem({ icon, onClick, disabled, children }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 w-full text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      {children}
    </button>
  );
}
