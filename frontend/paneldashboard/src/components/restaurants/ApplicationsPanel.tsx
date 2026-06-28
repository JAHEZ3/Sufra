"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Store, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveRestaurantApplication,
  useRestaurantApplications,
} from "@/hooks/useRestaurants";
import { extractApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";
import { RejectApplicationDialog } from "./RejectApplicationDialog";
import { cuisineLabel } from "./restaurant-labels";

export function ApplicationsPanel() {
  const { success, error } = useToast();
  const { data: applications, isLoading } = useRestaurantApplications();
  const approve = useApproveRestaurantApplication();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    approve.mutate(id, {
      onSuccess: () => success("تمت الموافقة على الطلب"),
      onError: (err) =>
        error("خطأ", extractApiErrorMessage(err, "تعذّر الموافقة على الطلب")),
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        لا توجد طلبات معلّقة حالياً
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {applications.map((app) => {
          const r = app.restaurant;
          const approving = approve.isPending && approve.variables === app.id;
          return (
            <div
              key={app.id}
              className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-muted overflow-hidden relative shrink-0">
                    {app.logoUrl ? (
                      <Image
                        src={app.logoUrl}
                        alt="Logo"
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">
                      {r?.name ?? "مطعم بلا اسم"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r?.cuisineType ? cuisineLabel[r.cuisineType] : "—"}
                    </p>
                  </div>
                </div>
                <Badge variant="warning">قيد المراجعة</Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-4">
                <div>
                  <dt className="text-[10px] mb-0.5">المالك</dt>
                  <dd className="font-medium text-foreground">
                    {r?.ownerName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] mb-0.5">الهاتف</dt>
                  <dd
                    className="font-medium text-foreground"
                    style={{ direction: "ltr", textAlign: "left" }}
                  >
                    {r?.phone ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] mb-0.5">المدينة</dt>
                  <dd className="font-medium text-foreground">
                    {r?.city ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] mb-0.5">تاريخ الطلب</dt>
                  <dd className="font-medium text-foreground">
                    {formatDateTime(app.submittedAt)}
                  </dd>
                </div>
              </dl>

              {app.ownerIdPictureUrl && (
                <a
                  href={app.ownerIdPictureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-info font-semibold mb-4 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  عرض هوية المالك
                </a>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleApprove(app.id)}
                  loading={approving}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  موافقة
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setRejectTarget(app.id)}
                  disabled={approving}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4" />
                  رفض
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <RejectApplicationDialog
        applicationId={rejectTarget}
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) setRejectTarget(null);
        }}
      />
    </>
  );
}
