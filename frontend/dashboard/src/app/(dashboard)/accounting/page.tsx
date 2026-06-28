"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { accountingApi, getApiError } from "@/lib/api";
import { useToast } from "@/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2, Loader2,
  Receipt, ShoppingBag, Bike,
} from "lucide-react";

type Period = "today" | "week" | "month";
type Category = "rent" | "salaries" | "supplies" | "utilities" | "other";

interface Expense {
  id: string;
  restaurantId: string;
  amount: number | string;
  category: Category;
  description: string | null;
  occurredAt: string;
  createdAt: string;
}

interface Summary {
  period: { from: string; to: string; label: Period };
  revenue: {
    total: number;
    pos: number;
    online: number;
    posOrders: number;
    onlineOrders: number;
  };
  expenses: {
    total: number;
    count: number;
    byCategory: Record<Category, number>;
  };
  netProfit: number;
}

const categoryLabel: Record<Category, string> = {
  rent: "إيجار",
  salaries: "رواتب",
  supplies: "موردين / مشتريات",
  utilities: "فواتير (كهرباء/ماء/إنترنت)",
  other: "أخرى",
};

const periodLabel: Record<Period, string> = {
  today: "اليوم",
  week: "آخر ٧ أيام",
  month: "آخر ٣٠ يوماً",
};

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

function ExpenseFormDialog({
  initial,
  trigger,
  onSubmit,
  pending,
}: {
  initial?: Expense;
  trigger: React.ReactNode;
  onSubmit: (data: { amount: number; category: Category; description?: string; occurredAt?: string }, close: () => void) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [category, setCategory] = useState<Category>(initial?.category ?? "other");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [occurredAt, setOccurredAt] = useState(
    initial?.occurredAt ? new Date(initial.occurredAt).toISOString().slice(0, 10) : "",
  );

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    onSubmit(
      {
        amount: amt,
        category,
        description: description.trim() || undefined,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      },
      () => setOpen(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={initial ? "تعديل المصروف" : "إضافة مصروف"}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">المبلغ *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">الفئة</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              {(Object.keys(categoryLabel) as Category[]).map((c) => (
                <option key={c} value={c}>{categoryLabel[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold">التاريخ</label>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">الوصف (اختياري)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="ملاحظات…"
            />
          </div>
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

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "success" | "danger" | "primary";
  icon: React.ReactNode;
}) {
  const toneCls =
    tone === "success" ? "bg-success/10 text-success" :
    tone === "danger"  ? "bg-danger/10 text-danger"   :
    "bg-primary/10 text-primary";
  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-semibold">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneCls}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-black ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-foreground"}`}>
        {formatCurrency(value)}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AccountingPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");

  const summaryQuery = useQuery<Summary>({
    queryKey: ["accounting-summary", period],
    queryFn: async () => unwrap<Summary>(await accountingApi.summary({ period })),
    refetchInterval: 30_000,
  });

  const expensesQuery = useQuery<Expense[]>({
    queryKey: ["expenses-list"],
    queryFn: async () => unwrap<Expense[]>(await accountingApi.listExpenses()) ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accounting-summary"] });
    qc.invalidateQueries({ queryKey: ["expenses-list"] });
  };

  const create = useMutation({
    mutationFn: async (data: { amount: number; category: Category; description?: string; occurredAt?: string }) =>
      accountingApi.createExpense(data),
    onSuccess: () => { invalidate(); success("تم إضافة المصروف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; data: object }) =>
      accountingApi.updateExpense(vars.id, vars.data),
    onSuccess: () => { invalidate(); success("تم تحديث المصروف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => accountingApi.deleteExpense(id),
    onSuccess: () => { invalidate(); success("تم حذف المصروف"); },
    onError: (e) => error("خطأ", getApiError(e)),
  });

  const summary = summaryQuery.data;
  const expenses = expensesQuery.data ?? [];

  const expensesByCategory = useMemo(() => {
    const empty: Record<Category, number> = { rent: 0, salaries: 0, supplies: 0, utilities: 0, other: 0 };
    return summary?.expenses.byCategory ?? empty;
  }, [summary]);

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground">المحاسبة</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              الإيرادات والمصاريف وصافي الربح للمطعم
            </p>
          </div>
          <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
            {(Object.keys(periodLabel) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {summaryQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-border animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="الإيراد الإجمالي"
                value={summary.revenue.total}
                hint={`${summary.revenue.posOrders + summary.revenue.onlineOrders} طلب مكتمل`}
                tone="success"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="إجمالي المصاريف"
                value={summary.expenses.total}
                hint={`${summary.expenses.count} سجل`}
                tone="danger"
                icon={<TrendingDown className="w-4 h-4" />}
              />
              <StatCard
                label="صافي الربح"
                value={summary.netProfit}
                hint={summary.netProfit >= 0 ? "ربح" : "خسارة"}
                tone={summary.netProfit >= 0 ? "primary" : "danger"}
                icon={<Wallet className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-border p-5">
                <h2 className="text-sm font-bold mb-3">مصدر الإيراد</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Receipt className="w-4 h-4" /> نقطة البيع
                    </span>
                    <span className="font-bold">
                      {formatCurrency(summary.revenue.pos)} ({summary.revenue.posOrders} طلب)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Bike className="w-4 h-4" /> طلبات إلكترونية
                    </span>
                    <span className="font-bold">
                      {formatCurrency(summary.revenue.online)} ({summary.revenue.onlineOrders} طلب)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-border p-5">
                <h2 className="text-sm font-bold mb-3">المصاريف حسب الفئة</h2>
                <div className="space-y-2 text-sm">
                  {(Object.keys(categoryLabel) as Category[]).map((c) => {
                    const v = expensesByCategory[c] ?? 0;
                    const pct = summary.expenses.total > 0 ? (v / summary.expenses.total) * 100 : 0;
                    return (
                      <div key={c} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{categoryLabel[c]}</span>
                          <span className="font-bold">{formatCurrency(v)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border">
            <div>
              <h2 className="text-sm font-bold">سجل المصاريف</h2>
              <p className="text-xs text-muted-foreground mt-0.5">آخر ٢٠٠ سجل</p>
            </div>
            <ExpenseFormDialog
              pending={create.isPending}
              trigger={<Button><Plus className="w-4 h-4" /> إضافة مصروف</Button>}
              onSubmit={(data, close) => create.mutate(data, { onSuccess: () => close() })}
            />
          </div>

          {expensesQuery.isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد مصاريف مسجلة بعد</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">التاريخ</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الفئة</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الوصف</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">المبلغ</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(e.occurredAt).toLocaleDateString("ar")}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {categoryLabel[e.category]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{e.description ?? "—"}</td>
                    <td className="px-5 py-3 font-bold">{formatCurrency(Number(e.amount))}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <ExpenseFormDialog
                          initial={e}
                          pending={update.isPending}
                          trigger={
                            <Button size="icon" variant="outline" className="w-8 h-8 rounded-lg" title="تعديل">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          }
                          onSubmit={(data, close) =>
                            update.mutate({ id: e.id, data }, { onSuccess: () => close() })
                          }
                        />
                        <Button
                          size="icon"
                          variant="danger"
                          className="w-8 h-8 rounded-lg"
                          title="حذف"
                          onClick={async () => {
                            if (await confirmDialog("حذف هذا المصروف؟")) remove.mutate(e.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
