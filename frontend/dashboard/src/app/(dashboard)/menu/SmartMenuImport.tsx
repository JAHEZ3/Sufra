"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useAnalyzeMenuImage,
  useApplyMenuImport,
} from "@/hooks/useMenu";
import type {
  Menu,
  MenuExtraction,
  ExtractedCategory,
  ExtractedItem,
  ExtractedOffer,
} from "@/types/menu.types";
import { useToast } from "@/providers/ToastProvider";
import { getApiError } from "@/lib/api";
import {
  Sparkles,
  Upload,
  ImagePlus,
  X,
  Loader2,
  ScanLine,
  Code2,
  ListTree,
} from "lucide-react";

const NEW_MENU_VALUE = "__new__";

interface SmartMenuImportProps {
  menus: Menu[];
  defaultMenuId?: string;
  onClose: () => void;
  onImported?: (createdMenuId: string) => void;
}

type Stage = "upload" | "analyzing" | "review" | "applying" | "done";

export function SmartMenuImport({
  menus,
  defaultMenuId,
  onClose,
  onImported,
}: SmartMenuImportProps) {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyze = useAnalyzeMenuImage();
  const apply = useApplyMenuImport();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<MenuExtraction | null>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [view, setView] = useState<"summary" | "json">("summary");

  const [targetMenu, setTargetMenu] = useState<string>(
    defaultMenuId ?? NEW_MENU_VALUE,
  );
  const [newMenuName, setNewMenuName] = useState<string>("");

  // Keep newMenuName seeded from the detected restaurant name when available.
  useEffect(() => {
    if (extraction?.restaurantName && !newMenuName) {
      setNewMenuName(extraction.restaurantName);
    }
  }, [extraction, newMenuName]);

  // Free the object URL when it changes or unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setExtraction(null);
    setStage("upload");
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setExtraction(null);
    setStage("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runAnalyze = () => {
    if (!imageFile) return;
    setStage("analyzing");
    analyze.mutate(imageFile, {
      onSuccess: (data) => {
        setExtraction(data);
        setStage("review");
      },
      onError: (err) => {
        setStage("upload");
        error("تعذر التحليل", getApiError(err));
      },
    });
  };

  const runApply = () => {
    if (!extraction) return;
    setStage("applying");
    apply.mutate(
      {
        targetMenuId:
          targetMenu === NEW_MENU_VALUE ? undefined : targetMenu,
        menuName:
          targetMenu === NEW_MENU_VALUE
            ? newMenuName.trim() || undefined
            : undefined,
        extraction,
      },
      {
        onSuccess: (res) => {
          setStage("done");
          success(
            "تم استيراد القائمة",
            `${res.sectionsCreated} قسم · ${res.mealsCreated} وجبة`,
          );
          onImported?.(res.menuId);
        },
        onError: (err) => {
          setStage("review");
          error("فشل الاستيراد", getApiError(err));
        },
      },
    );
  };

  const totals = useMemo(() => {
    if (!extraction)
      return { categories: 0, items: 0, offers: 0, sized: 0 };
    const items = extraction.categories.reduce(
      (acc, c) => acc + c.items.length,
      0,
    );
    const sized = extraction.categories.reduce(
      (acc, c) =>
        acc +
        c.items.filter((i) => Array.isArray(i.sizes) && i.sizes.length >= 2)
          .length,
      0,
    );
    return {
      categories: extraction.categories.length,
      items,
      offers: extraction.offers?.length ?? 0,
      sized,
    };
  }, [extraction]);

  return (
    <DialogContent
      title="استيراد ذكي للقائمة"
      description="ارفع صورة قائمة طعام وسيقوم الذكاء الاصطناعي باستخراج الأقسام والوجبات والأسعار تلقائياً."
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <StepDot active={stage === "upload"} done={stage !== "upload"}>
            <Upload className="w-3 h-3" />
            رفع
          </StepDot>
          <Separator />
          <StepDot
            active={stage === "analyzing"}
            done={stage === "review" || stage === "applying" || stage === "done"}
          >
            <ScanLine className="w-3 h-3" />
            تحليل
          </StepDot>
          <Separator />
          <StepDot
            active={stage === "review" || stage === "applying"}
            done={stage === "done"}
          >
            <ListTree className="w-3 h-3" />
            مراجعة
          </StepDot>
          <Separator />
          <StepDot active={stage === "done"} done={stage === "done"}>
            <Sparkles className="w-3 h-3" />
            تم
          </StepDot>
        </div>

        {/* Image picker */}
        {stage !== "done" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              صورة القائمة
            </label>
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                <Image
                  src={previewUrl}
                  alt="معاينة"
                  width={800}
                  height={400}
                  className="w-full max-h-72 object-contain bg-muted"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={stage === "analyzing" || stage === "applying"}
                  className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title="إزالة الصورة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary-light/30 transition-colors"
              >
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  اسحب صورة القائمة هنا أو اضغط للاختيار
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG · JPG · WEBP — حتى 5 ميجابايت
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickImage}
            />
          </div>
        )}

        {/* Analyze CTA */}
        {stage === "upload" && (
          <Button
            type="button"
            className="w-full"
            disabled={!imageFile}
            onClick={runAnalyze}
          >
            <Sparkles className="w-4 h-4" />
            تحليل القائمة
          </Button>
        )}

        {/* Loading */}
        {stage === "analyzing" && (
          <div className="border border-border rounded-xl p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              جاري تحليل الصورة...
            </p>
            <p className="text-xs text-muted-foreground">
              قد يستغرق هذا بضع ثوانٍ.
            </p>
          </div>
        )}

        {/* Review */}
        {(stage === "review" || stage === "applying") && extraction && (
          <ReviewPanel
            extraction={extraction}
            totals={totals}
            view={view}
            onViewChange={setView}
            menus={menus}
            targetMenu={targetMenu}
            onTargetMenuChange={setTargetMenu}
            newMenuName={newMenuName}
            onNewMenuNameChange={setNewMenuName}
            onApply={runApply}
            applying={stage === "applying"}
          />
        )}

        {/* Done */}
        {stage === "done" && (
          <div className="border border-border rounded-xl p-6 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              تم استيراد القائمة بنجاح
            </h3>
            <p className="text-xs text-muted-foreground">
              راجع الأقسام والوجبات الجديدة في إدارة القائمة.
            </p>
            <DialogClose asChild>
              <Button className="mt-2" onClick={onClose}>
                إغلاق
              </Button>
            </DialogClose>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ReviewPanel({
  extraction,
  totals,
  view,
  onViewChange,
  menus,
  targetMenu,
  onTargetMenuChange,
  newMenuName,
  onNewMenuNameChange,
  onApply,
  applying,
}: {
  extraction: MenuExtraction;
  totals: { categories: number; items: number; offers: number; sized: number };
  view: "summary" | "json";
  onViewChange: (v: "summary" | "json") => void;
  menus: Menu[];
  targetMenu: string;
  onTargetMenuChange: (v: string) => void;
  newMenuName: string;
  onNewMenuNameChange: (v: string) => void;
  onApply: () => void;
  applying: boolean;
}) {
  const isNewMenu = targetMenu === NEW_MENU_VALUE;
  const canApply =
    totals.categories > 0 &&
    totals.items > 0 &&
    (!isNewMenu || newMenuName.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {extraction.restaurantName && (
            <Badge variant="default" className="font-bold">
              {extraction.restaurantName}
            </Badge>
          )}
          <Badge variant="default">
            {totals.categories} قسم · {totals.items} وجبة
          </Badge>
          {totals.offers > 0 && (
            <Badge variant="warning">{totals.offers} عرض</Badge>
          )}
          {totals.sized > 0 && (
            <Badge variant="default">{totals.sized} متعدد الأحجام</Badge>
          )}
          <Badge variant="default">
            {labelForLanguage(extraction.language)}
          </Badge>
          {extraction.currency && (
            <Badge variant="default">{extraction.currency}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-full p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onViewChange("summary")}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              view === "summary"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListTree className="w-3 h-3 inline-block ml-1" />
            ملخص
          </button>
          <button
            type="button"
            onClick={() => onViewChange("json")}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              view === "json"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="w-3 h-3 inline-block ml-1" />
            JSON
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="border border-border rounded-xl bg-muted/20 max-h-72 overflow-y-auto p-3">
        {view === "summary" ? (
          <SummaryView extraction={extraction} />
        ) : (
          <pre className="text-[11px] leading-relaxed font-mono text-foreground whitespace-pre-wrap break-words">
            {JSON.stringify(extraction, null, 2)}
          </pre>
        )}
      </div>

      {/* Target menu selection */}
      <div className="space-y-3 border-t border-border pt-4">
        <Select
          label="إضافة إلى"
          value={targetMenu}
          onValueChange={onTargetMenuChange}
        >
          <SelectItem value={NEW_MENU_VALUE}>إنشاء قائمة جديدة</SelectItem>
          {menus.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </Select>
        {isNewMenu && (
          <Input
            label="اسم القائمة الجديدة *"
            value={newMenuName}
            onChange={(e) => onNewMenuNameChange(e.target.value)}
            placeholder={extraction.restaurantName ?? "مثال: القائمة الرئيسية"}
            required
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          className="flex-1"
          onClick={onApply}
          loading={applying}
          disabled={!canApply}
        >
          <Sparkles className="w-4 h-4" />
          استيراد إلى القائمة
        </Button>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={applying}>
            إلغاء
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}

function SummaryView({ extraction }: { extraction: MenuExtraction }) {
  if (extraction.categories.length === 0 && extraction.offers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        لم يتمكن النموذج من استخراج أي محتوى من الصورة. جرّب صورة أوضح.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {extraction.categories.map((cat, idx) => (
        <CategoryBlock key={`${cat.name}-${idx}`} cat={cat} currency={extraction.currency} />
      ))}
      {extraction.offers.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-warning" />
            العروض
          </h5>
          <div className="space-y-1.5 pr-2">
            {extraction.offers.map((offer, idx) => (
              <OfferRow key={`${offer.name}-${idx}`} offer={offer} currency={extraction.currency} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  cat,
  currency,
}: {
  cat: ExtractedCategory;
  currency: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-bold text-foreground">
        {cat.name}{" "}
        <span className="text-muted-foreground font-normal">
          ({cat.items.length})
        </span>
      </h5>
      <div className="space-y-1.5 pr-2">
        {cat.items.map((item, idx) => (
          <ItemRow key={`${item.name}-${idx}`} item={item} currency={currency} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  currency,
}: {
  item: ExtractedItem;
  currency: string | null;
}) {
  return (
    <div className="bg-white rounded-lg border border-border px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-foreground truncate">
            {item.name}
          </div>
          {item.description && (
            <div className="text-[11px] text-muted-foreground truncate">
              {item.description}
            </div>
          )}
        </div>
        <div className="text-xs font-black text-primary whitespace-nowrap">
          {formatPrice(item.price, item.currency ?? currency)}
        </div>
      </div>
      {Array.isArray(item.sizes) && item.sizes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.sizes.map((s, idx) => (
            <span
              key={`${s.label}-${idx}`}
              className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground"
            >
              {s.label}
              {s.price != null
                ? ` · ${formatPrice(s.price, item.currency ?? currency)}`
                : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  currency,
}: {
  offer: ExtractedOffer;
  currency: string | null;
}) {
  return (
    <div className="bg-warning-light/40 rounded-lg border border-warning/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-foreground truncate">
            {offer.name}
          </div>
          {offer.description && (
            <div className="text-[11px] text-muted-foreground truncate">
              {offer.description}
            </div>
          )}
          {offer.items && offer.items.length > 0 && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {offer.items.join(" · ")}
            </div>
          )}
        </div>
        <div className="text-xs font-black text-warning whitespace-nowrap">
          {formatPrice(offer.price, offer.currency ?? currency)}
        </div>
      </div>
    </div>
  );
}

function StepDot({
  active,
  done,
  children,
}: {
  active?: boolean;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium transition-colors ${
        done
          ? "bg-primary-light text-primary"
          : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function Separator() {
  return <span className="flex-1 h-px bg-border" />;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const code = currency || "ILS";
  return `${Number(value).toLocaleString("ar-PS", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${code}`;
}

function labelForLanguage(lang: MenuExtraction["language"]) {
  switch (lang) {
    case "ar":
      return "عربي";
    case "en":
      return "English";
    case "mixed":
      return "ثنائي اللغة";
    default:
      return "—";
  }
}

