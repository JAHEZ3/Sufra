"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag, Inbox, Image as ImageIcon } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";
import { extractApiErrorMessage } from "@/lib/api";
import { useToast } from "@/providers/ToastProvider";
import type { RestaurantCategory } from "@/types/category.types";

export default function CategoriesPage() {
  const { data, isLoading } = useCategories();
  const items = data ?? [];

  const [editing, setEditing] = useState<RestaurantCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RestaurantCategory | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="تصنيفات المطاعم" subtitle="إدارة تصنيفات المطاعم المعروضة في التطبيق" />

      <div className="p-6 space-y-5 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {items.length.toLocaleString("ar-SA")} تصنيف
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            إضافة تصنيف
          </Button>
        </div>

        <Card>
          {isLoading && items.length === 0 ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground">لا توجد تصنيفات بعد.</p>
              <p className="text-sm text-muted-foreground mt-1">
                أضف أول تصنيف لتبدأ بتنظيم المطاعم.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                >
                  <CategoryIcon category={category} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{category.name}</p>
                    {category.iconUrl && (
                      <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                        {category.iconUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(category)}
                    >
                      <Pencil className="w-4 h-4" />
                      تعديل
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleting(category)}
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <CreateCategoryDialog open={creating} onOpenChange={setCreating} />
      <EditCategoryDialog
        category={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteCategoryDialog
        category={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}

function CategoryIcon({ category }: { category: RestaurantCategory }) {
  if (category.iconUrl) {
    return (
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={category.iconUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <Tag className="w-5 h-5" />
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { success, error } = useToast();
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  function reset() {
    setName("");
    setIconUrl("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      error("بيانات ناقصة", "يرجى إدخال اسم التصنيف.");
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        ...(iconUrl.trim() && { iconUrl: iconUrl.trim() }),
      },
      {
        onSuccess: () => {
          success("تم الحفظ", "تم إضافة التصنيف.");
          reset();
          onOpenChange(false);
        },
        onError: (err) =>
          error("فشل الإضافة", extractApiErrorMessage(err, "تعذّر إضافة التصنيف.")),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة تصنيف</DialogTitle>
          <DialogDescription>
            تظهر التصنيفات في تطبيق العميل وفي اختيارات المطاعم.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <Input
              label="اسم التصنيف"
              placeholder="مثال: بيتزا"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
            <Input
              label="رابط الأيقونة (اختياري)"
              placeholder="https://..."
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              startIcon={<ImageIcon className="w-4 h-4" />}
              dir="ltr"
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" loading={create.isPending}>
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditCategoryDialog({
  category,
  onOpenChange,
}: {
  category: RestaurantCategory | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { success, error } = useToast();
  const update = useUpdateCategory();
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIconUrl(category.iconUrl ?? "");
    }
  }, [category]);

  function close() {
    setName("");
    setIconUrl("");
    onOpenChange(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    if (!name.trim()) {
      error("بيانات ناقصة", "يرجى إدخال اسم التصنيف.");
      return;
    }
    const payload = {
      name: name.trim(),
      iconUrl: iconUrl.trim() ? iconUrl.trim() : null,
    };
    update.mutate(
      { id: category.id, payload },
      {
        onSuccess: () => {
          success("تم الحفظ", "تم تحديث التصنيف.");
          close();
        },
        onError: (err) =>
          error("فشل التحديث", extractApiErrorMessage(err, "تعذّر تحديث التصنيف.")),
      },
    );
  }

  return (
    <Dialog open={Boolean(category)} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل التصنيف</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <Input
              label="اسم التصنيف"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            <Input
              label="رابط الأيقونة (اختياري)"
              placeholder="https://..."
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              startIcon={<ImageIcon className="w-4 h-4" />}
              dir="ltr"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              إلغاء
            </Button>
            <Button type="submit" loading={update.isPending}>
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteCategoryDialog({
  category,
  onOpenChange,
}: {
  category: RestaurantCategory | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { success, error } = useToast();
  const del = useDeleteCategory();

  function handleDelete() {
    if (!category) return;
    del.mutate(category.id, {
      onSuccess: () => {
        success("تم الحذف", "تم حذف التصنيف.");
        onOpenChange(false);
      },
      onError: (err) =>
        error("فشل الحذف", extractApiErrorMessage(err, "تعذّر حذف التصنيف.")),
    });
  }

  return (
    <Dialog open={Boolean(category)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف التصنيف</DialogTitle>
          <DialogDescription>
            سيتم حذف &quot;{category?.name}&quot; نهائياً. لا يمكن التراجع عن هذه الخطوة.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={del.isPending}>
            تأكيد الحذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
