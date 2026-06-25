"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import {
  useMenu,
  useCreateMenu,
  useUpdateMenu,
  useDeleteMenu,
  useReorderMenus,
  useCreateMeal,
  useUpdateMeal,
  useDeleteMeal,
  useToggleMealAvailability,
  useGenerateMealAiImage,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useReorderMeals,
  useOptionGroups,
  useCreateOptionGroup,
  useUpdateOptionGroup,
  useDeleteOptionGroup,
  useOptions,
  useCreateOption,
  useUpdateOption,
  useDeleteOption,
} from "@/hooks/useMenu";
import { Menu, MenuSection, Meal, MealOptionGroup, MealOption, MenuSelectionType } from "@/types/menu.types";
import type { CreateMealDto, UpdateMealDto } from "@/dto/meal.dto";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectItem } from "@/components/ui/select";
import { mealsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  UtensilsCrossed, Eye, EyeOff, ImagePlus, X,
  ArrowUp, ArrowDown, Settings2, BookOpen, Sparkles,
} from "lucide-react";
import { useToast } from "@/providers/ToastProvider";
import { SmartMenuImport } from "./SmartMenuImport";

interface MealFormData {
  name: string;
  description: string;
  basePrice: string;
  discountPrice: string;
  calories: string;
  isAvailable: boolean;
  isFeatured: boolean;
  tags: string;
}

function MealFormDialog({
  meal,
  sectionId,
  sections,
  onClose,
}: {
  meal?: Meal;
  sectionId?: string;
  sections: MenuSection[];
  onClose?: () => void;
}) {
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<MealFormData>({
    name: meal?.name ?? "",
    description: meal?.description ?? "",
    basePrice: meal?.basePrice?.toString() ?? "",
    discountPrice: meal?.discountPrice?.toString() ?? "",
    calories: meal?.calories?.toString() ?? "",
    isAvailable: meal?.isAvailable ?? true,
    isFeatured: meal?.isFeatured ?? false,
    tags: meal?.tags?.join("، ") ?? "",
  });
  // For edit, default to the meal's own section (NOT the first section in the
  // list). Sending the wrong sectionId triggers a 400 "Invalid section ID".
  const [selectedSection, setSelectedSection] = useState(
    meal?.sectionId ?? sectionId ?? sections[0]?.id ?? "",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Local preview URL — null means "show whatever the meal already has".
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // AI menu copywriting — fill the description from the name (+ price/section).
  const handleGenerateDescription = async () => {
    if (!form.name.trim()) {
      error("اسم الوجبة مطلوب", "أدخل اسم الوجبة أولاً لتوليد الوصف.");
      return;
    }
    setAiLoading(true);
    try {
      const sectionName = sections.find((s) => s.id === selectedSection)?.name;
      const res = await mealsApi.generateCopy({
        name: form.name.trim(),
        price: form.basePrice ? parseFloat(form.basePrice) : undefined,
        sectionName,
      });
      const description = (res.data?.data ?? res.data)?.description ?? "";
      if (description) {
        setForm((f) => ({ ...f, description }));
        success("تم توليد الوصف");
      } else {
        error("خطأ", "لم يتم توليد وصف.");
      }
    } catch {
      error("خطأ", "تعذّر توليد الوصف بالذكاء الاصطناعي.");
    } finally {
      setAiLoading(false);
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const clearImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const tagList = form.tags
      ? form.tags.split("،").map((t) => t.trim()).filter(Boolean)
      : [];

    // Build a clean JSON payload first. Numbers stay numbers, booleans stay
    // booleans — backend DTO validation passes without coercion gymnastics.
    // sectionId is only sent on create (PATCH identifies the meal by URL).
    const payload: Record<string, unknown> = {
      name: form.name,
      basePrice: parseFloat(form.basePrice),
      isAvailable: form.isAvailable,
      isFeatured: form.isFeatured,
      tags: tagList,
    };
    if (!meal) payload.sectionId = selectedSection;
    if (form.description) payload.description = form.description;
    if (form.discountPrice) payload.discountPrice = parseFloat(form.discountPrice);
    if (form.calories) payload.calories = parseInt(form.calories);

    // Only switch to multipart when actually uploading an image. Without an
    // image, JSON is simpler and avoids backend type-coercion pitfalls.
    let body: CreateMealDto | UpdateMealDto | FormData;
    if (imageFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
        else if (typeof v === "boolean" || typeof v === "number") fd.append(k, String(v));
        else fd.append(k, v as string);
      });
      fd.append("image", imageFile);
      body = fd;
    } else {
      body = payload as unknown as CreateMealDto;
    }

    if (meal) {
      updateMeal.mutate(
        { id: meal.id, data: body as UpdateMealDto | FormData },
        { onSuccess: () => { success("تم تحديث الوجبة"); onClose?.(); }, onError: () => error("خطأ", "فشل تحديث الوجبة") }
      );
    } else {
      createMeal.mutate(body as CreateMealDto | FormData, {
        onSuccess: () => { success("تم إضافة الوجبة"); onClose?.(); },
        onError: () => error("خطأ", "فشل إضافة الوجبة"),
      });
    }
  };

  const isPending = createMeal.isPending || updateMeal.isPending;
  const shownImage = previewUrl ?? meal?.imageUrl ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!meal && (
        <Select label="القسم" value={selectedSection} onValueChange={setSelectedSection}>
          {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </Select>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">صورة الوجبة</label>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
            {shownImage ? (
              <Image src={shownImage} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
            ) : (
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {shownImage ? "تغيير الصورة" : "اختر صورة"}
            </Button>
            {shownImage && previewUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
                <X className="w-3.5 h-3.5" /> إزالة
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
        </div>
      </div>

      <Input label="اسم الوجبة *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: برجر لحم مميز" required />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">الوصف</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateDescription}
            loading={aiLoading}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary-light/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            اكتب بالذكاء الاصطناعي
          </Button>
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="وصف مختصر للوجبة..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="السعر الأساسي (SR) *"
          type="number"
          step="0.01"
          value={form.basePrice}
          onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
          placeholder="0.00"
          required
        />
        <Input
          label="سعر الخصم (SR)"
          type="number"
          step="0.01"
          value={form.discountPrice}
          onChange={(e) => setForm({ ...form, discountPrice: e.target.value })}
          placeholder="اختياري"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="السعرات الحرارية"
          type="number"
          value={form.calories}
          onChange={(e) => setForm({ ...form, calories: e.target.value })}
          placeholder="مثال: 650"
        />
        <Input
          label="الوسوم (مفصولة بـ ،)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="أكثر مبيعاً، صحي"
        />
      </div>

      <div className="flex gap-6">
        <Switch
          checked={form.isAvailable}
          onCheckedChange={(v) => setForm({ ...form, isAvailable: v })}
          label="متاح للطلب"
        />
        <Switch
          checked={form.isFeatured}
          onCheckedChange={(v) => setForm({ ...form, isFeatured: v })}
          label="مميز"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" loading={isPending}>
          {meal ? "حفظ التغييرات" : "إضافة الوجبة"}
        </Button>
        <DialogClose asChild>
          <Button type="button" variant="outline">إلغاء</Button>
        </DialogClose>
      </div>
    </form>
  );
}

function MealCard({
  meal,
  sections,
  meals,
  index,
}: {
  meal: Meal;
  sections: MenuSection[];
  meals: Meal[];
  index: number;
}) {
  const deleteMeal = useDeleteMeal();
  const toggleAvail = useToggleMealAvailability();
  const generateImage = useGenerateMealAiImage();
  const reorderMeals = useReorderMeals();
  const { success, error } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const move = (dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= meals.length) return;
    const arr = meals.map((m) => m.id);
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderMeals.mutate(
      { sectionId: meal.sectionId, orderedIds: arr },
      { onError: () => error("خطأ", "فشل ترتيب الوجبات") },
    );
  };

  return (
    <div className={`bg-white rounded-xl border p-4 transition-all hover:shadow-md ${!meal.isAvailable ? "opacity-60 border-border" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden text-2xl">
          {meal.imageUrl ? (
            <Image
              src={meal.imageUrl}
              alt={meal.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            "🍔"
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-foreground truncate">{meal.name}</h4>
            {meal.isFeatured && <Badge variant="warning" className="text-[10px] px-1.5 py-0">⭐ مميز</Badge>}
            {!meal.isAvailable && <Badge variant="error" className="text-[10px] px-1.5 py-0">غير متاح</Badge>}
          </div>

          {meal.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{meal.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-black text-primary">{formatCurrency(meal.basePrice)}</span>
            {meal.discountPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(meal.discountPrice)}</span>
            )}
            {meal.calories && (
              <span className="text-xs text-muted-foreground">{meal.calories} سعر</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => move(-1)}
            disabled={index === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأعلى"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => move(1)}
            disabled={index === meals.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأسفل"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() =>
              toggleAvail.mutate(meal.id, {
                onSuccess: () =>
                  success(meal.isAvailable ? "تم إيقاف الوجبة" : "تم تفعيل الوجبة"),
                onError: () => error("خطأ", "فشل تحديث الحالة"),
              })
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            title={meal.isAvailable ? "إيقاف" : "تفعيل"}
          >
            {meal.isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() =>
              generateImage.mutate(meal.id, {
                onSuccess: () => success("تم توليد الصورة بالذكاء الاصطناعي"),
                onError: (e) => error("خطأ", e instanceof Error ? e.message : "فشل توليد الصورة"),
              })
            }
            disabled={generateImage.isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            title="توليد صورة بالذكاء الاصطناعي"
          >
            {generateImage.isPending ? (
              <Sparkles className="w-4 h-4 animate-pulse" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>

          <Dialog>
            <DialogTrigger asChild>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                title="الخيارات"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent title={`خيارات: ${meal.name}`}>
              <OptionsManager mealId={meal.id} />
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" title="تعديل">
                <Pencil className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent title="تعديل الوجبة">
              <MealFormDialog meal={meal} sections={sections} onClose={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>

          <button
            onClick={async () => {
              if (!(await confirmDialog(`حذف وجبة "${meal.name}"؟`))) return;
              deleteMeal.mutate(meal.id, {
                onSuccess: () => success("تم حذف الوجبة"),
                onError: () => error("خطأ", "فشل حذف الوجبة"),
              });
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-error-light hover:text-error transition-colors"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Options manager ──────────────────────────────────────────────────────────
// Nested CRUD: option groups for a meal, plus options for each group. Reads
// fresh from the backend (the menu tree from useMenu doesn't include these).
function OptionsManager({ mealId }: { mealId: string }) {
  const { data: groups, isLoading } = useOptionGroups(mealId);
  const createGroup = useCreateOptionGroup();
  const { success, error } = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState<MenuSelectionType>(MenuSelectionType.SINGLE);
  const [required, setRequired] = useState(false);
  const [maxSel, setMaxSel] = useState("");

  const submitGroup = () => {
    if (!name.trim()) return;
    createGroup.mutate(
      {
        mealId,
        data: {
          name: name.trim(),
          selectionType: type,
          isRequired: required,
          maxSelections: maxSel ? parseInt(maxSel) : undefined,
        },
      },
      {
        onSuccess: () => {
          success("تم إضافة المجموعة");
          setName("");
          setMaxSel("");
          setRequired(false);
          setType(MenuSelectionType.SINGLE);
        },
        onError: () => error("خطأ", "فشل إضافة المجموعة"),
      },
    );
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1">
      {/* Existing groups */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : groups?.length ? (
        groups.map((g) => <OptionGroupRow key={g.id} group={g} mealId={mealId} />)
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          لا توجد مجموعات خيارات بعد
        </p>
      )}

      {/* Add group form */}
      <div className="border-t border-border pt-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">إضافة مجموعة جديدة</h4>
        <Input
          label="اسم المجموعة"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: الحجم"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="النوع"
            value={type}
            onValueChange={(v) => setType(v as MenuSelectionType)}
          >
            <SelectItem value={MenuSelectionType.SINGLE}>اختيار واحد</SelectItem>
            <SelectItem value={MenuSelectionType.MULTIPLE}>اختيار متعدد</SelectItem>
          </Select>
          <Input
            label="أقصى عدد"
            type="number"
            value={maxSel}
            onChange={(e) => setMaxSel(e.target.value)}
            placeholder="اختياري"
          />
        </div>
        <Switch
          checked={required}
          onCheckedChange={setRequired}
          label="مطلوب"
        />
        <Button
          className="w-full"
          loading={createGroup.isPending}
          disabled={!name.trim()}
          onClick={submitGroup}
        >
          إضافة المجموعة
        </Button>
      </div>
    </div>
  );
}

function OptionGroupRow({ group, mealId }: { group: MealOptionGroup; mealId: string }) {
  const updateGroup = useUpdateOptionGroup(mealId);
  const deleteGroup = useDeleteOptionGroup(mealId);
  const { data: options } = useOptions(group.id);
  const createOption = useCreateOption();
  const updateOption = useUpdateOption(group.id);
  const deleteOption = useDeleteOption(group.id);
  const { success, error } = useToast();

  const [editName, setEditName] = useState(group.name);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");

  const saveGroup = () => {
    if (!editName.trim() || editName.trim() === group.name) return;
    updateGroup.mutate(
      { id: group.id, data: { name: editName.trim() } },
      {
        onSuccess: () => success("تم تحديث المجموعة"),
        onError: () => error("خطأ", "فشل التحديث"),
      },
    );
  };

  const removeGroup = async () => {
    if (!(await confirmDialog(`حذف مجموعة "${group.name}"؟`))) return;
    deleteGroup.mutate(group.id, {
      onSuccess: () => success("تم حذف المجموعة"),
      onError: () => error("خطأ", "فشل الحذف"),
    });
  };

  const addOption = () => {
    if (!optName.trim()) return;
    createOption.mutate(
      {
        groupId: group.id,
        data: {
          name: optName.trim(),
          extraPrice: optPrice ? parseFloat(optPrice) : 0,
        },
      },
      {
        onSuccess: () => {
          success("تم إضافة الخيار");
          setOptName("");
          setOptPrice("");
        },
        onError: () => error("خطأ", "فشل إضافة الخيار"),
      },
    );
  };

  return (
    <div className="border border-border rounded-xl p-3 space-y-3">
      {/* Group header */}
      <div className="flex items-center gap-2">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveGroup}
          className="flex-1"
        />
        <Badge variant={group.isRequired ? "warning" : "default"} className="text-[10px]">
          {group.selectionType === MenuSelectionType.SINGLE ? "واحد" : "متعدد"}
          {group.isRequired ? " · مطلوب" : ""}
        </Badge>
        <button
          onClick={removeGroup}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-error-light hover:text-error transition-colors"
          title="حذف المجموعة"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Options list */}
      <div className="space-y-1.5 pl-3">
        {(options ?? []).map((opt) => (
          <OptionRow
            key={opt.id}
            opt={opt}
            onSave={(data) =>
              updateOption.mutate(
                { id: opt.id, data },
                { onError: () => error("خطأ", "فشل تحديث الخيار") },
              )
            }
            onDelete={async () => {
              if (!(await confirmDialog(`حذف خيار "${opt.name}"؟`))) return;
              deleteOption.mutate(opt.id, {
                onSuccess: () => success("تم حذف الخيار"),
                onError: () => error("خطأ", "فشل الحذف"),
              });
            }}
          />
        ))}
      </div>

      {/* Add option */}
      <div className="flex gap-2 pt-1">
        <Input
          value={optName}
          onChange={(e) => setOptName(e.target.value)}
          placeholder="اسم الخيار"
          className="flex-1"
        />
        <Input
          value={optPrice}
          onChange={(e) => setOptPrice(e.target.value)}
          placeholder="+0.00"
          type="number"
          step="0.01"
          className="w-24"
        />
        <Button
          size="sm"
          onClick={addOption}
          loading={createOption.isPending}
          disabled={!optName.trim()}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function OptionRow({
  opt,
  onSave,
  onDelete,
}: {
  opt: MealOption;
  onSave: (data: { name?: string; extraPrice?: number; isAvailable?: boolean }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(opt.name);
  const [price, setPrice] = useState(opt.extraPrice.toString());

  const flush = () => {
    const trimmed = name.trim();
    const parsed = price ? parseFloat(price) : 0;
    if (trimmed === opt.name && parsed === opt.extraPrice) return;
    onSave({ name: trimmed || opt.name, extraPrice: parsed });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={flush}
        className="flex-1 h-8 text-sm"
      />
      <Input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={flush}
        type="number"
        step="0.01"
        className="w-20 h-8 text-sm"
      />
      <Switch
        checked={opt.isAvailable}
        onCheckedChange={(v) => onSave({ isAvailable: v })}
      />
      <button
        onClick={onDelete}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-error-light hover:text-error transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SectionBlock({
  section,
  sections,
  index,
  menuId,
}: {
  section: MenuSection;
  sections: MenuSection[];
  index: number;
  menuId: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editName, setEditName] = useState(section.name);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const { success, error } = useToast();

  const moveSection = (dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const arr = sections.map((s) => s.id);
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderSections.mutate(
      { menuId, orderedIds: arr },
      { onError: () => error("خطأ", "فشل ترتيب الأقسام") },
    );
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{section.name}</h3>
            <p className="text-xs text-muted-foreground">{section.meals.length} وجبة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); moveSection(-1); }}
            disabled={index === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأعلى"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveSection(1); }}
            disabled={index === sections.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأسفل"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <Dialog open={addMealOpen} onOpenChange={setAddMealOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-8">
                <Plus className="w-3.5 h-3.5" /> إضافة وجبة
              </Button>
            </DialogTrigger>
            <DialogContent title="إضافة وجبة جديدة" description={`إضافة وجبة إلى قسم: ${section.name}`}>
              <MealFormDialog sectionId={section.id} sections={sections} onClose={() => setAddMealOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={editSectionOpen} onOpenChange={setEditSectionOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                title="تعديل القسم"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent title="تعديل القسم">
              <div className="space-y-4">
                <Input
                  label="اسم القسم"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={updateSection.isPending}
                    disabled={!editName.trim() || editName.trim() === section.name}
                    onClick={() =>
                      updateSection.mutate(
                        { id: section.id, data: { name: editName.trim() } },
                        {
                          onSuccess: () => { success("تم تحديث القسم"); setEditSectionOpen(false); },
                          onError: () => error("خطأ", "فشل تحديث القسم"),
                        },
                      )
                    }
                  >
                    حفظ
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">إلغاء</Button>
                  </DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!(await confirmDialog(`حذف قسم "${section.name}" وكل وجباته؟`))) return;
              deleteSection.mutate(section.id, {
                onSuccess: () => success("تم حذف القسم"),
                onError: () => error("خطأ", "فشل حذف القسم"),
              });
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-error-light hover:text-error transition-colors"
            title="حذف القسم"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {section.meals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              لا توجد وجبات في هذا القسم بعد
            </p>
          ) : (
            section.meals.map((meal, idx) => (
              <MealCard
                key={meal.id}
                meal={meal}
                sections={sections}
                meals={section.meals}
                index={idx}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Menu tabs ────────────────────────────────────────────────────────────────
function MenuTabs({
  menus,
  activeId,
  onSelect,
}: {
  menus: Menu[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const createMenu = useCreateMenu();
  const updateMenu = useUpdateMenu();
  const deleteMenu = useDeleteMenu();
  const reorderMenus = useReorderMenus();
  const { success, error } = useToast();

  const [newName, setNewName] = useState("");
  const activeMenu = menus.find((m) => m.id === activeId);
  const [editName, setEditName] = useState(activeMenu?.name ?? "");
  const activeIndex = menus.findIndex((m) => m.id === activeId);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);

  const moveMenu = (dir: -1 | 1) => {
    if (activeIndex < 0) return;
    const target = activeIndex + dir;
    if (target < 0 || target >= menus.length) return;
    const arr = menus.map((m) => m.id);
    [arr[activeIndex], arr[target]] = [arr[target], arr[activeIndex]];
    reorderMenus.mutate(arr, {
      onError: () => error("خطأ", "فشل ترتيب القوائم"),
    });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex items-center gap-1.5">
        {menus.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
              m.id === activeId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline-block ml-1.5" />
            {m.name}
          </button>
        ))}
      </div>

      {/* Add menu */}
      <Dialog open={addMenuOpen} onOpenChange={setAddMenuOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 shrink-0">
            <Plus className="w-3.5 h-3.5" /> قائمة جديدة
          </Button>
        </DialogTrigger>
        <DialogContent title="إضافة قائمة جديدة">
          <div className="space-y-4">
            <Input
              label="اسم القائمة"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: قائمة الإفطار"
            />
            <Button
              className="w-full"
              loading={createMenu.isPending}
              disabled={!newName.trim()}
              onClick={() =>
                createMenu.mutate(
                  { name: newName.trim() },
                  {
                    onSuccess: () => {
                      success("تم إضافة القائمة");
                      setNewName("");
                      setAddMenuOpen(false);
                    },
                    onError: () => error("خطأ", "فشل إضافة القائمة"),
                  },
                )
              }
            >
              إضافة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reorder + edit + delete active menu */}
      {activeMenu && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => moveMenu(-1)}
            disabled={activeIndex === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأعلى"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => moveMenu(1)}
            disabled={activeIndex === menus.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="نقل لأسفل"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <Dialog open={editMenuOpen} onOpenChange={setEditMenuOpen}>
            <DialogTrigger asChild>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                title="تعديل القائمة"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent title={`تعديل: ${activeMenu.name}`}>
              <div className="space-y-4">
                <Input
                  label="اسم القائمة"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Switch
                  checked={activeMenu.isActive}
                  onCheckedChange={(v) =>
                    updateMenu.mutate(
                      { id: activeMenu.id, data: { isActive: v } },
                      { onError: () => error("خطأ", "فشل التحديث") },
                    )
                  }
                  label="نشطة"
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={updateMenu.isPending}
                    disabled={!editName.trim() || editName.trim() === activeMenu.name}
                    onClick={() =>
                      updateMenu.mutate(
                        { id: activeMenu.id, data: { name: editName.trim() } },
                        {
                          onSuccess: () => { success("تم تحديث القائمة"); setEditMenuOpen(false); },
                          onError: () => error("خطأ", "فشل التحديث"),
                        },
                      )
                    }
                  >
                    حفظ
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">إلغاء</Button>
                  </DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={async () => {
              if (!(await confirmDialog(`حذف قائمة "${activeMenu.name}" وكل أقسامها ووجباتها؟`))) return;
              deleteMenu.mutate(activeMenu.id, {
                onSuccess: () => success("تم حذف القائمة"),
                onError: () => error("خطأ", "فشل الحذف"),
              });
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-error-light hover:text-error transition-colors"
            title="حذف القائمة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  const { data: menus, isLoading } = useMenu();
  const createMenu = useCreateMenu();
  const createSection = useCreateSection();
  const { success, error } = useToast();

  const [newMenuName, setNewMenuName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | undefined>();
  const [topAddMenuOpen, setTopAddMenuOpen] = useState(false);
  const [topAddSectionOpen, setTopAddSectionOpen] = useState(false);
  const [topAddMealOpen, setTopAddMealOpen] = useState(false);
  const [emptyAddSectionOpen, setEmptyAddSectionOpen] = useState(false);
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  // Default to the first menu when data loads, but keep user selection sticky.
  const resolvedActiveId =
    activeMenuId && menus?.some((m) => m.id === activeMenuId)
      ? activeMenuId
      : menus?.[0]?.id;
  const activeMenu = menus?.find((m) => m.id === resolvedActiveId);
  const allSections = activeMenu?.sections ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground">إدارة القائمة</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeMenu?.name ? `${activeMenu.name} · ` : ""}
              {allSections.reduce((acc, s) => acc + s.meals.length, 0)} وجبة في {allSections.length} قسم
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Smart Menu Import — AI-powered seeding from a menu photo */}
            <Dialog open={smartImportOpen} onOpenChange={setSmartImportOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary-light/40"
                >
                  <Sparkles className="w-4 h-4" />
                  استيراد ذكي
                </Button>
              </DialogTrigger>
              {smartImportOpen && (
                <SmartMenuImport
                  menus={menus ?? []}
                  defaultMenuId={resolvedActiveId}
                  onClose={() => setSmartImportOpen(false)}
                  onImported={(menuId) => setActiveMenuId(menuId)}
                />
              )}
            </Dialog>

            {/* Add Menu — always enabled, the primary entry to seed data */}
            <Dialog open={topAddMenuOpen} onOpenChange={setTopAddMenuOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookOpen className="w-4 h-4" /> إضافة قائمة
                </Button>
              </DialogTrigger>
              <DialogContent
                title="إضافة قائمة جديدة"
                description="القائمة تجمع الأقسام والوجبات. يمكنك إنشاء أكثر من قائمة (مثلاً: إفطار، غداء)."
              >
                <div className="space-y-4">
                  <Input
                    label="اسم القائمة *"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="مثال: القائمة الرئيسية"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      loading={createMenu.isPending}
                      disabled={!newMenuName.trim()}
                      onClick={() =>
                        createMenu.mutate(
                          { name: newMenuName.trim() },
                          {
                            onSuccess: (res) => {
                              success("تم إضافة القائمة");
                              setNewMenuName("");
                              setTopAddMenuOpen(false);
                              // Auto-select the freshly created menu so the user
                              // can immediately add sections to it.
                              const created = (res?.data as { data?: { id?: string } } | undefined)?.data;
                              if (created?.id) setActiveMenuId(created.id);
                            },
                            onError: () => error("خطأ", "فشل إضافة القائمة"),
                          },
                        )
                      }
                    >
                      إضافة
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">إلغاء</Button>
                    </DialogClose>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add Section — needs an active menu */}
            <Dialog open={topAddSectionOpen} onOpenChange={setTopAddSectionOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!activeMenu?.id}>
                  <Plus className="w-4 h-4" /> قسم جديد
                </Button>
              </DialogTrigger>
              <DialogContent
                title="إضافة قسم جديد"
                description={activeMenu?.name ? `سيُضاف إلى قائمة: ${activeMenu.name}` : undefined}
              >
                <div className="space-y-4">
                  <Input
                    label="اسم القسم *"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="مثال: المشروبات"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      loading={createSection.isPending}
                      disabled={!activeMenu?.id || !newSectionName.trim()}
                      onClick={() =>
                        createSection.mutate(
                          { menuId: activeMenu!.id, data: { name: newSectionName.trim() } },
                          {
                            onSuccess: () => { success("تم إضافة القسم"); setNewSectionName(""); setTopAddSectionOpen(false); },
                            onError: () => error("خطأ", "فشل إضافة القسم"),
                          },
                        )
                      }
                    >
                      إضافة
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">إلغاء</Button>
                    </DialogClose>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add Meal — primary action, needs at least one section */}
            <Dialog open={topAddMealOpen} onOpenChange={setTopAddMealOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={allSections.length === 0}>
                  <Plus className="w-4 h-4" /> إضافة وجبة
                </Button>
              </DialogTrigger>
              <DialogContent
                title="إضافة وجبة جديدة"
                description={activeMenu?.name ? `إلى قائمة: ${activeMenu.name}` : undefined}
              >
                <MealFormDialog sections={allSections} onClose={() => setTopAddMealOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Menu tabs */}
        {!isLoading && menus && menus.length > 0 && (
          <MenuTabs
            menus={menus}
            activeId={resolvedActiveId}
            onSelect={setActiveMenuId}
          />
        )}

        {/* Sections */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-4" />
                <div className="space-y-3">
                  {[1, 2].map((j) => <div key={j} className="h-16 bg-muted rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {allSections.map((section, idx) => (
              <SectionBlock
                key={section.id}
                section={section}
                sections={allSections}
                index={idx}
                menuId={activeMenu!.id}
              />
            ))}
            {!activeMenu && (
              <div className="bg-white rounded-xl border border-border p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-bold text-foreground">لا توجد قوائم بعد</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  ابدأ بإنشاء قائمة، ثم أضف أقسامًا ووجبات
                </p>
              </div>
            )}
            {allSections.length === 0 && activeMenu && (
              <div className="bg-white rounded-xl border border-border p-12 text-center">
                <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-bold text-foreground">لا توجد أقسام بعد</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">ابدأ بإضافة قسم ثم أضف الوجبات</p>
                <Dialog open={emptyAddSectionOpen} onOpenChange={setEmptyAddSectionOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4" /> إضافة قسم جديد</Button>
                  </DialogTrigger>
                  <DialogContent title="إضافة قسم جديد">
                    <Input label="اسم القسم" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} />
                    <Button
                      className="w-full mt-4"
                      loading={createSection.isPending}
                      disabled={!activeMenu?.id || !newSectionName.trim()}
                      onClick={() =>
                        createSection.mutate(
                          { menuId: activeMenu!.id, data: { name: newSectionName.trim() } },
                          {
                            onSuccess: () => { success("تم إضافة القسم"); setNewSectionName(""); setEmptyAddSectionOpen(false); },
                            onError: () => error("خطأ", "فشل إضافة القسم"),
                          },
                        )
                      }
                    >
                      إضافة
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
