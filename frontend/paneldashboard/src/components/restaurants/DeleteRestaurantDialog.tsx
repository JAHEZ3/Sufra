"use client";

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
import { useDeleteRestaurant } from "@/hooks/useRestaurants";
import { extractApiErrorMessage } from "@/lib/api";
import { useToast } from "@/providers/ToastProvider";

interface DeleteRestaurantDialogProps {
  restaurantId: string | null;
  restaurantName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRestaurantDialog({
  restaurantId,
  restaurantName,
  open,
  onOpenChange,
}: DeleteRestaurantDialogProps) {
  const { success, error } = useToast();
  const del = useDeleteRestaurant();

  const handleDelete = () => {
    if (!restaurantId) return;
    del.mutate(restaurantId, {
      onSuccess: () => {
        success("تم حذف المطعم");
        onOpenChange(false);
      },
      onError: (err) =>
        error("خطأ", extractApiErrorMessage(err, "تعذّر حذف المطعم")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>حذف المطعم</DialogTitle>
          <DialogDescription>
            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المطعم{" "}
            <span className="font-bold text-foreground">
              {restaurantName ?? "—"}
            </span>{" "}
            وجميع بياناته بشكل دائم.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد أنك تريد المتابعة؟
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            إلغاء
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={del.isPending}
          >
            حذف نهائي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
