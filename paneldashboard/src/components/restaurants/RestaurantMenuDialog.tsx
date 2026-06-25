"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Flame,
  Inbox,
  Search,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRestaurantFull } from "@/hooks/useRestaurants";
import { cn } from "@/lib/utils";
import type {
  Meal,
  MealOptionGroup,
  Menu,
  MenuSection,
} from "@/types/restaurant-full.types";

interface RestaurantMenuDialogProps {
  restaurantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestaurantMenuDialog({
  restaurantId,
  open,
  onOpenChange,
}: RestaurantMenuDialogProps) {
  const { data, isLoading, isError } = useRestaurantFull(
    open ? restaurantId ?? undefined : undefined,
  );
  const [search, setSearch] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const menus: Menu[] = useMemo(
    () =>
      [...(data?.menus ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
    [data],
  );

  const currentMenu: Menu | null = useMemo(() => {
    if (menus.length === 0) return null;
    if (activeMenuId) {
      const found = menus.find((m) => m.id === activeMenuId);
      if (found) return found;
    }
    return menus[0];
  }, [menus, activeMenuId]);

  const filteredSections = useMemo<MenuSection[]>(() => {
    if (!currentMenu) return [];
    const q = search.trim().toLowerCase();
    if (!q) return currentMenu.sections;

    return currentMenu.sections
      .map((section) => ({
        ...section,
        meals: section.meals.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.description ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.meals.length > 0);
  }, [currentMenu, search]);

  const totals = useMemo(() => {
    if (!data) return { menus: 0, sections: 0, meals: 0 };
    let sections = 0;
    let meals = 0;
    for (const m of data.menus) {
      sections += m.sections.length;
      for (const s of m.sections) meals += s.meals.length;
    }
    return { menus: data.menus.length, sections, meals };
  }, [data]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSearch("");
          setActiveMenuId(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>قائمة المطعم</DialogTitle>
          <DialogDescription>
            عرض القوائم والأقسام والوجبات وخيارات كل وجبة.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-error text-center py-8">
              تعذّر تحميل القائمة.
            </p>
          ) : data.menus.length === 0 ? (
            <EmptyState
              title="لا توجد قوائم بعد"
              subtitle="لم يقم المطعم بإضافة أي قائمة طعام حتى الآن."
            />
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatPill label="القوائم" value={totals.menus} />
                <StatPill label="الأقسام" value={totals.sections} />
                <StatPill label="الوجبات" value={totals.meals} />
              </div>

              {/* Menu tabs (only if more than one) */}
              {menus.length > 1 && (
                <div className="flex flex-wrap gap-1.5 bg-muted rounded-xl p-1">
                  {menus.map((m) => {
                    const isActive = (currentMenu?.id ?? menus[0].id) === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveMenuId(m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          isActive
                            ? "bg-white text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.name}
                        {!m.isActive && (
                          <span className="mr-2 text-[10px] text-muted-foreground">
                            (معطّلة)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search */}
              <Input
                placeholder="ابحث في الوجبات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startIcon={<Search className="w-4 h-4" />}
              />

              {/* Sections */}
              {filteredSections.length === 0 ? (
                <EmptyState
                  title={search ? "لا توجد نتائج" : "لا توجد أقسام"}
                  subtitle={
                    search
                      ? "جرّب كلمة بحث مختلفة."
                      : "لم تتم إضافة أقسام إلى هذه القائمة."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredSections.map((section) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      defaultOpen={Boolean(search) || section.meals.length <= 6}
                    />
                  ))}
                </div>
              )}
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

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  defaultOpen,
}: {
  section: MenuSection;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
          <span className="font-bold text-foreground text-sm truncate">
            {section.name}
          </span>
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {section.meals.length.toLocaleString("ar-SA")}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {section.meals.map((meal) => (
            <MealRow key={meal.id} meal={meal} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Meal row ─────────────────────────────────────────────────────────────────

function MealRow({ meal }: { meal: Meal }) {
  const [showOptions, setShowOptions] = useState(false);
  const hasOptions = meal.optionGroups && meal.optionGroups.length > 0;

  return (
    <li
      className={cn(
        "p-4 flex gap-4",
        !meal.isAvailable && "opacity-60",
      )}
    >
      {/* Image */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-border relative">
        {meal.imageUrl ? (
          <Image
            src={meal.imageUrl}
            alt={meal.name}
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-foreground text-sm truncate">
                {meal.name}
              </p>
              {meal.isFeatured && (
                <Star className="w-3.5 h-3.5 text-warning fill-warning" />
              )}
              {!meal.isAvailable && (
                <Badge variant="muted" className="text-[10px]">
                  غير متاحة
                </Badge>
              )}
            </div>
            {meal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {meal.description}
              </p>
            )}
          </div>
          <PriceTag base={meal.basePrice} discount={meal.discountPrice} />
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {meal.calories != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Flame className="w-3 h-3" />
              {meal.calories} ك.ح
            </span>
          )}
          {meal.tags?.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {hasOptions && (
          <button
            type="button"
            onClick={() => setShowOptions((s) => !s)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform",
                showOptions && "rotate-180",
              )}
            />
            {showOptions
              ? "إخفاء الخيارات"
              : `عرض الخيارات (${meal.optionGroups.length})`}
          </button>
        )}

        {showOptions && hasOptions && (
          <div className="mt-2 space-y-2">
            {meal.optionGroups.map((g) => (
              <OptionGroup key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function OptionGroup({ group }: { group: MealOptionGroup }) {
  const selectionLabel =
    group.selectionType === "single" ? "اختيار واحد" : "اختيار متعدد";
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <span className="font-bold text-foreground">{group.name}</span>
        <span className="text-muted-foreground">· {selectionLabel}</span>
        {group.isRequired && (
          <span className="text-error font-semibold">· إلزامي</span>
        )}
        {group.maxSelections && group.selectionType === "multiple" && (
          <span className="text-muted-foreground">
            · حتى {group.maxSelections}
          </span>
        )}
      </div>
      <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
        {group.options.map((o) => (
          <li
            key={o.id}
            className={cn(
              "flex items-center justify-between text-[11px]",
              !o.isAvailable && "text-muted-foreground line-through",
            )}
          >
            <span>{o.name}</span>
            {Number(o.extraPrice) > 0 && (
              <span className="text-muted-foreground tabular-nums">
                +{formatSar(o.extraPrice)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function PriceTag({
  base,
  discount,
}: {
  base: number;
  discount: number | null;
}) {
  const hasDiscount =
    discount != null && Number(discount) > 0 && Number(discount) < Number(base);
  return (
    <div className="flex flex-col items-end shrink-0">
      <span className="text-sm font-black text-primary tabular-nums">
        {formatSar(hasDiscount ? discount! : base)}
      </span>
      {hasDiscount && (
        <span className="text-[10px] text-muted-foreground line-through tabular-nums">
          {formatSar(base)}
        </span>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/60 rounded-xl px-3 py-2 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-black text-foreground tabular-nums">
        {value.toLocaleString("ar-SA")}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Inbox className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="font-bold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function formatSar(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} شيكل`;
}
