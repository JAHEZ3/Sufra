"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { inventoryApi, getApiError } from "@/lib/api";
import { useToast } from "@/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";
import {
  Package, AlertTriangle, TrendingDown, Wallet, Plus, Pencil, Trash2,
  ArrowDownToLine, ArrowUpFromLine, Settings2, Loader2, History,
} from "lucide-react";

type Unit = "kg" | "g" | "l" | "ml" | "piece" | "box" | "pack" | "bottle" | "dozen" | "bag";
type MovementType = "in" | "out" | "adjustment";

interface InventoryItem {
  id: string;
  restaurantId: string;
  name: string;
  sku: string | null;
  unit: Unit;
  currentQuantity: number | string;
  reorderThreshold: number | string;
  unitCost: number | string;
  isActive: boolean;
}

interface Movement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number | string;
  unitCost: number | string | null;
  note: string | null;
  createdAt: string;
}

interface Summary {
  totals: {
    items: number;
    active: number;
    lowStock: number;
    outOfStock: number;
    stockValue: number;
  };
  lowStock: InventoryItem[];
}

const unitLabel: Record<Unit, string> = {
  kg: "كغ",
  g: "غ",
  l: "لتر",
  ml: "مل",
  piece: "قطعة",
  box: "صندوق",
  pack: "عبوة",
  bottle: "زجاجة",
  dozen: "دزينة",
  bag: "كيس",
};

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

const fmtQty = (n: number | string, unit: Unit) =>
  `${Number(n).toLocaleString("ar", { maximumFractionDigits: 3 })} ${unitLabel[unit]}`;

function ItemFormDialog({
  initial,
  trigger,
  onSubmit,
  pending,
}: {
  initial?: InventoryItem;
  trigger: React.ReactNode;
  onSubmit: (
    data: {
      name: string;
      sku?: string;
      unit: Unit;
      currentQuantity?: number;
      reorderThreshold?: number;
      unitCost?: number;
      isActive: boolean;
    },
    close: () => void,
  ) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "piece");
  const [currentQuantity, setCurrentQuantity] = useState(String(initial?.currentQuantity ?? ""));
  const [reorderThreshold, setReorderThreshold] = useState(String(initial?.reorderThreshold ?? ""));
  const [unitCost, setUnitCost] = useState(String(initial?.unitCost ?? ""));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(
      {
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit,
        // On edit we don't pass currentQuantity — use movements to change stock.
        currentQuantity: initial ? undefined : Number(currentQuantity) || 0,
        reorderThreshold: Number(reorderThreshold) || 0,
        unitCost: Number(unitCost) || 0,
        isActive,
      },
      () => setOpen(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={initial ? "تعديل الصنف" : "إضافة صنف جديد"}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">الاسم *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="مثال: طماطم"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">الوحدة</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-white"
              >
                {(Object.keys(unitLabel) as Unit[]).map((u) => (
                  <option key={u} value={u}>{unitLabel[u]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold">SKU (اختياري)</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="ITEM-001"
                dir="ltr"
              />
            </div>
          </div>
          {!initial && (
            <div>
              <label className="text-xs font-semibold">الكمية الافتتاحية</label>
              <input
                type="number"
                step="0.001"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold">حد التنبيه</label>
              <input
                type="number"
                step="0.001"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">تكلفة الوحدة</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="0.00"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            نشط
          </label>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} loading={pending} className="flex-1">
              {initial ? "حفظ" : "إضافة"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  item,
  defaultType,
  trigger,
  onSubmit,
  pending,
}: {
  item: InventoryItem;
  defaultType: MovementType;
  trigger: React.ReactNode;
  onSubmit: (
    data: { type: MovementType; quantity: number; unitCost?: number; note?: string },
    close: () => void,
  ) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MovementType>(defaultType);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(String(item.unitCost ?? ""));
  const [note, setNote] = useState("");

  const submit = () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) return;
    onSubmit(
      {
        type,
        quantity: qty,
        unitCost: type === "in" ? Number(unitCost) || undefined : undefined,
        note: note.trim() || undefined,
      },
      () => {
        setOpen(false);
        setQuantity("");
        setNote("");
      },
    );
  };

  const titleByType: Record<MovementType, string> = {
    in: "إدخال مخزون",
    out: "إخراج مخزون",
    adjustment: "تعديل (هدر / تصحيح)",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`${titleByType[type]} · ${item.name}`}>
        <div className="space-y-3">
          <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
            {(["in", "out", "adjustment"] as MovementType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  type === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {titleByType[t]}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold">
              الكمية ({unitLabel[item.unit]})
              {type === "adjustment" && (
                <span className="text-muted-foreground"> · موجب يضيف، سالب يطرح</span>
              )}
            </label>
            <input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="0"
            />
          </div>
          {type === "in" && (
            <div>
              <label className="text-xs font-semibold">تكلفة الوحدة (اختياري)</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="0.00"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold">ملاحظة</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="استلام من المورد / هدر / تصحيح جرد..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} loading={pending} className="flex-1">
              تسجيل
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "warning" | "danger" | "success";
  icon: React.ReactNode;
}) {
  const toneCls =
    tone === "warning" ? "bg-warning/10 text-warning" :
    tone === "danger"  ? "bg-danger/10 text-danger"   :
    tone === "success" ? "bg-success/10 text-success" :
    "bg-primary/10 text-primary";
  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-semibold">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneCls}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function InventoryPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);

  const summaryQuery = useQuery<Summary>({
    queryKey: ["inventory-summary"],
    queryFn: async () => unwrap<Summary>(await inventoryApi.summary()),
    refetchInterval: 30_000,
  });

  const itemsQuery = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items"],
    queryFn: async () => unwrap<InventoryItem[]>(await inventoryApi.listItems()) ?? [],
  });

  const movementsQuery = useQuery<Movement[]>({
    queryKey: ["inventory-movements", historyItemId],
    queryFn: async () =>
      unwrap<Movement[]>(await inventoryApi.listMovements(historyItemId ? { itemId: historyItemId, limit: 50 } : { limit: 50 })) ?? [],
    enabled: true,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["inventory-summary"] });
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    qc.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const createItem = useMutation({
    mutationFn: async (data: Parameters<typeof inventoryApi.createItem>[0]) =>
      inventoryApi.createItem(data),
    onSuccess: () => { invalidate(); success("تم إضافة الصنف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const updateItem = useMutation({
    mutationFn: async (vars: { id: string; data: object }) =>
      inventoryApi.updateItem(vars.id, vars.data),
    onSuccess: () => { invalidate(); success("تم تحديث الصنف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => inventoryApi.deleteItem(id),
    onSuccess: () => { invalidate(); success("تم حذف الصنف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const recordMovement = useMutation({
    mutationFn: async (vars: { itemId: string; data: Parameters<typeof inventoryApi.recordMovement>[1] }) =>
      inventoryApi.recordMovement(vars.itemId, vars.data),
    onSuccess: () => { invalidate(); success("تم تسجيل الحركة"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const items = itemsQuery.data ?? [];
  const summary = summaryQuery.data;
  const movements = movementsQuery.data ?? [];

  const itemsById = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground">إدارة المخزون</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              أصناف، حركات، وتنبيهات إعادة الطلب
            </p>
          </div>
          <ItemFormDialog
            pending={createItem.isPending}
            trigger={<Button><Plus className="w-4 h-4" /> إضافة صنف</Button>}
            onSubmit={(data, close) => createItem.mutate(data, { onSuccess: () => close() })}
          />
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="عدد الأصناف"
              value={`${summary.totals.active} / ${summary.totals.items}`}
              hint="نشطة / إجمالي"
              tone="primary"
              icon={<Package className="w-4 h-4" />}
            />
            <StatCard
              label="قيمة المخزون"
              value={formatCurrency(summary.totals.stockValue)}
              hint="بأسعار التكلفة"
              tone="success"
              icon={<Wallet className="w-4 h-4" />}
            />
            <StatCard
              label="منخفض المخزون"
              value={`${summary.totals.lowStock}`}
              hint="تحت حد التنبيه"
              tone="warning"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
            <StatCard
              label="نفد المخزون"
              value={`${summary.totals.outOfStock}`}
              hint="كمية = 0"
              tone="danger"
              icon={<TrendingDown className="w-4 h-4" />}
            />
          </div>
        )}

        {summary && summary.lowStock.length > 0 && (
          <div className="bg-warning/5 border border-warning/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-bold text-warning">أصناف تحتاج إعادة طلب</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.lowStock.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg bg-white border border-warning/40"
                >
                  <Package className="w-3 h-3" />
                  {it.name}
                  <span className="text-warning">
                    {fmtQty(it.currentQuantity, it.unit)} / {fmtQty(it.reorderThreshold, it.unit)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold">الأصناف</h2>
            <span className="text-xs text-muted-foreground">{items.length} صنف</span>
          </div>
          {itemsQuery.isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد أصناف بعد</p>
              <p className="text-xs mt-0.5">ابدأ بإضافة المكونات والمستلزمات</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الاسم</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">SKU</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الكمية</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">حد التنبيه</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">تكلفة الوحدة</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it) => {
                  const qty = Number(it.currentQuantity);
                  const reorder = Number(it.reorderThreshold);
                  const isLow = it.isActive && reorder > 0 && qty <= reorder;
                  const isOut = it.isActive && qty <= 0;
                  return (
                    <tr key={it.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-bold">{it.name}</p>
                        {!it.isActive && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">متوقف</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono" dir="ltr">
                        {it.sku ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-bold ${
                            isOut ? "text-danger" : isLow ? "text-warning" : "text-foreground"
                          }`}
                        >
                          {fmtQty(qty, it.unit)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {reorder > 0 ? fmtQty(reorder, it.unit) : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs">{formatCurrency(Number(it.unitCost))}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <MovementDialog
                            item={it}
                            defaultType="in"
                            pending={recordMovement.isPending}
                            trigger={
                              <Button size="icon" variant="outline" className="w-8 h-8 rounded-lg" title="إدخال">
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </Button>
                            }
                            onSubmit={(data, close) =>
                              recordMovement.mutate({ itemId: it.id, data }, { onSuccess: () => close() })
                            }
                          />
                          <MovementDialog
                            item={it}
                            defaultType="out"
                            pending={recordMovement.isPending}
                            trigger={
                              <Button size="icon" variant="outline" className="w-8 h-8 rounded-lg" title="إخراج">
                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                              </Button>
                            }
                            onSubmit={(data, close) =>
                              recordMovement.mutate({ itemId: it.id, data }, { onSuccess: () => close() })
                            }
                          />
                          <MovementDialog
                            item={it}
                            defaultType="adjustment"
                            pending={recordMovement.isPending}
                            trigger={
                              <Button size="icon" variant="outline" className="w-8 h-8 rounded-lg" title="تعديل">
                                <Settings2 className="w-3.5 h-3.5" />
                              </Button>
                            }
                            onSubmit={(data, close) =>
                              recordMovement.mutate({ itemId: it.id, data }, { onSuccess: () => close() })
                            }
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8 rounded-lg"
                            title="السجل"
                            onClick={() => setHistoryItemId(historyItemId === it.id ? null : it.id)}
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                          <ItemFormDialog
                            initial={it}
                            pending={updateItem.isPending}
                            trigger={
                              <Button size="icon" variant="outline" className="w-8 h-8 rounded-lg" title="تعديل البيانات">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            }
                            onSubmit={(data, close) =>
                              updateItem.mutate({ id: it.id, data }, { onSuccess: () => close() })
                            }
                          />
                          <Button
                            size="icon"
                            variant="danger"
                            className="w-8 h-8 rounded-lg"
                            title="حذف"
                            onClick={async () => {
                              if (await confirmDialog(`حذف "${it.name}"؟ السجل سيُحفظ.`)) {
                                deleteItem.mutate(it.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">سجل الحركات</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {historyItemId ? `صنف واحد · ${itemsById.get(historyItemId)?.name ?? ""}` : "جميع الأصناف"}
              </p>
            </div>
            {historyItemId && (
              <Button variant="outline" size="sm" onClick={() => setHistoryItemId(null)}>
                عرض الكل
              </Button>
            )}
          </div>
          {movementsQuery.isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <History className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا توجد حركات بعد</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {movements.map((m) => {
                const item = itemsById.get(m.itemId);
                const qty = Number(m.quantity);
                const inflow = qty > 0;
                return (
                  <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      m.type === "in" ? "bg-success/10 text-success" :
                      m.type === "out" ? "bg-danger/10 text-danger" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {m.type === "in" ? <ArrowDownToLine className="w-4 h-4" /> :
                       m.type === "out" ? <ArrowUpFromLine className="w-4 h-4" /> :
                       <Settings2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item?.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString("ar")}
                        {m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${inflow ? "text-success" : "text-danger"}`}>
                      {inflow ? "+" : ""}{item ? fmtQty(qty, item.unit) : qty}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
