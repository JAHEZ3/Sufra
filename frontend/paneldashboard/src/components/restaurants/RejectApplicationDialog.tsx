"use client";

import { useEffect, useState } from "react";
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
import { useRejectRestaurantApplication } from "@/hooks/useRestaurants";
import { extractApiErrorMessage } from "@/lib/api";
import { useToast } from "@/providers/ToastProvider";

interface RejectApplicationDialogProps {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectApplicationDialog({
  applicationId,
  open,
  onOpenChange,
}: RejectApplicationDialogProps) {
  const { success, error } = useToast();
  const reject = useRejectRestaurantApplication();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleReject = () => {
    if (!applicationId) return;
    reject.mutate(
      { id: applicationId, payload: { reason: reason.trim() || undefined } },
      {
        onSuccess: () => {
          success("تم رفض الطلب");
          onOpenChange(false);
        },
        onError: (err) =>
          error("خطأ", extractApiErrorMessage(err, "تعذّر رفض الطلب")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>رفض طلب الانضمام</DialogTitle>
          <DialogDescription>
            اذكر سبب الرفض (اختياري). سيتم إشعار صاحب الطلب بالنتيجة.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            السبب
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="مثال: المستندات غير واضحة، يرجى إعادة الرفع."
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
          />
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={reject.isPending}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
