"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageIcon, Sparkles, Info, MapPin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurant } from "@/hooks/useRestaurants";
import { LocationPicker, type PickedLocation } from "@/components/ui/location-picker";
import { extractApiErrorMessage, restaurantsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useToast } from "@/providers/ToastProvider";
import {
  CuisineType,
  type UpdateRestaurantPayload,
} from "@/types/restaurant.types";
import { cuisineLabel } from "./restaurant-labels";

interface EditRestaurantDialogProps {
  restaurantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  description: string;
  phone: string;
  street: string;
  city: string;
  cuisineType: CuisineType | "";
  logoUrl: string;
  coverUrl: string;
  lat: number | null;
  lng: number | null;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  phone: "",
  street: "",
  city: "",
  cuisineType: "",
  logoUrl: "",
  coverUrl: "",
  lat: null,
  lng: null,
};

export function EditRestaurantDialog({
  restaurantId,
  open,
  onOpenChange,
}: EditRestaurantDialogProps) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const { data: r, isLoading } = useRestaurant(
    open ? (restaurantId ?? undefined) : undefined,
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [accentColor, setAccentColor] = useState("");

  useEffect(() => {
    if (r) {
      setForm({
        name: r.name ?? "",
        description: r.description ?? "",
        phone: r.phone ?? "",
        street: r.street ?? "",
        city: r.city ?? "",
        cuisineType: r.cuisineType ?? "",
        logoUrl: r.logoUrl ?? "",
        coverUrl: r.coverUrl ?? "",
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      });
    } else if (!open) {
      setForm(emptyForm);
      setAccentColor("");
    }
  }, [r, open]);

  const update = useMutation({
    mutationFn: (payload: UpdateRestaurantPayload) => {
      if (!restaurantId) throw new Error("Missing restaurant id");
      return restaurantsApi.update(restaurantId, payload);
    },
    onSuccess: () => {
      if (restaurantId) {
        qc.invalidateQueries({
          queryKey: queryKeys.restaurants.detail(restaurantId),
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
      success("تم حفظ التعديلات");
      onOpenChange(false);
    },
    onError: (err) =>
      error("خطأ", extractApiErrorMessage(err, "تعذّر حفظ التعديلات")),
  });

  const generateCover = useMutation({
    mutationFn: () => {
      if (!restaurantId) throw new Error("Missing restaurant id");
      const trimmed = accentColor.trim();
      const payload =
        trimmed && /^#[0-9a-fA-F]{6}$/.test(trimmed)
          ? { accentColor: trimmed }
          : undefined;
      return restaurantsApi.generateCover(restaurantId, payload);
    },
    onSuccess: (res) => {
      const newUrl = res.data?.data?.coverUrl ?? "";
      if (newUrl) {
        setForm((prev) => ({ ...prev, coverUrl: newUrl }));
      }
      if (restaurantId) {
        qc.invalidateQueries({
          queryKey: queryKeys.restaurants.detail(restaurantId),
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.restaurants.root });
      success("تم إنشاء صورة الغلاف", "تم تحديث الغلاف بنسخة مولّدة بالذكاء.");
    },
    onError: (err) =>
      error(
        "تعذّر إنشاء الغلاف",
        extractApiErrorMessage(err, "حدث خطأ أثناء توليد الصورة. حاول لاحقاً."),
      ),
  });

  const canGenerate =
    !!restaurantId && form.name.trim().length > 0 && !generateCover.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !r) return;
    const payload: UpdateRestaurantPayload = {};
    if (form.name !== (r.name ?? "")) payload.name = form.name;
    if (form.description !== (r.description ?? ""))
      payload.description = form.description;
    if (form.phone !== (r.phone ?? "")) payload.phone = form.phone;
    if (form.street !== (r.street ?? "")) payload.street = form.street;
    if (form.city !== (r.city ?? "")) payload.city = form.city;
    if (form.cuisineType !== (r.cuisineType ?? "") && form.cuisineType !== "") {
      payload.cuisineType = form.cuisineType;
    }
    if (form.logoUrl !== (r.logoUrl ?? "")) payload.logoUrl = form.logoUrl;
    if (form.coverUrl !== (r.coverUrl ?? "")) payload.coverUrl = form.coverUrl;
    if (form.lat != null && form.lat !== (r.lat != null ? Number(r.lat) : null)) {
      payload.lat = form.lat;
    }
    if (form.lng != null && form.lng !== (r.lng != null ? Number(r.lng) : null)) {
      payload.lng = form.lng;
    }
    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    update.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المطعم</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    صورة الغلاف
                  </label>
                  <div className="relative h-36 rounded-xl bg-muted overflow-hidden border border-border">
                    {form.coverUrl ? (
                      <Image
                        src={form.coverUrl}
                        alt="Cover preview"
                        fill
                        sizes="(max-width: 768px) 100vw, 560px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="w-5 h-5" />
                        لا توجد صورة غلاف
                      </div>
                    )}
                    <div className="absolute -bottom-6 right-4 w-16 h-16 rounded-2xl bg-white border border-border shadow-md overflow-hidden">
                      {form.logoUrl ? (
                        <Image
                          src={form.logoUrl}
                          alt="Logo preview"
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-[10px] text-muted-foreground">
                          شعار
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-6">
                    <Input
                      placeholder="https://…/cover.jpg"
                      value={form.coverUrl}
                      onChange={(e) =>
                        setForm({ ...form, coverUrl: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>

                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 mt-2 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">
                          توليد غلاف بالذكاء الاصطناعي
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          ينشئ صورة غلاف احترافية اعتماداً على اسم المطعم ووصفه
                          ونوع المطبخ. كلما كان الوصف مفصّلاً كانت النتيجة أدقّ.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="#176f49 (اختياري)"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        dir="ltr"
                        className="sm:max-w-[180px] h-9 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => generateCover.mutate()}
                        loading={generateCover.isPending}
                        disabled={!canGenerate}
                        className="sm:mr-auto"
                      >
                        <Sparkles className="w-4 h-4" />
                        {form.coverUrl ? "إعادة التوليد" : "توليد الغلاف"}
                      </Button>
                    </div>

                    {!form.description.trim() && (
                      <p className="flex items-center gap-1.5 text-[11px] text-warning">
                        <Info className="w-3 h-3" />
                        أضف وصفاً للمطعم أدناه ثم احفظ التعديلات قبل التوليد
                        للحصول على نتيجة أفضل.
                      </p>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label="رابط الشعار"
                    placeholder="https://…/logo.jpg"
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm({ ...form, logoUrl: e.target.value })
                    }
                    dir="ltr"
                  />
                </div>
                <Input
                  label="الاسم"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="الهاتف"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  dir="ltr"
                />
                <Input
                  label="المدينة"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Input
                  label="الشارع"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    موقع المطعم على الخريطة
                  </label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    اسحب الدبوس أو اضغط على الخريطة لتحديث الموقع. يتم تعبئة
                    المدينة والشارع تلقائياً من Mapbox.
                  </p>
                  <LocationPicker
                    value={
                      form.lat != null && form.lng != null
                        ? { lat: form.lat, lng: form.lng }
                        : null
                    }
                    onChange={(loc: PickedLocation) =>
                      setForm((prev) => ({
                        ...prev,
                        lat: loc.lat,
                        lng: loc.lng,
                        city: prev.city || loc.city || prev.city,
                        street: prev.street || loc.street || prev.street,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">
                    نوع المطبخ
                  </label>
                  <Select
                    value={form.cuisineType || undefined}
                    onValueChange={(v) =>
                      setForm({ ...form, cuisineType: v as CuisineType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع المطبخ" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CuisineType).map((c) => (
                        <SelectItem key={c} value={c}>
                          {cuisineLabel[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">
                    الوصف
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={4}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              إلغاء
            </Button>
            <Button type="submit" size="sm" loading={update.isPending}>
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
