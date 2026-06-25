"use client";

import { Coins, ChevronDown } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { CURRENCY_LIST, type CurrencyCode } from "@/lib/currency";

/** مُحدِّد العملة — يغيّر عملة اللوحة ديناميكياً ويحفظها. */
export function CurrencySelect() {
  const { code, setCurrency } = useCurrency();

  return (
    <div className="relative flex items-center">
      <Coins className="pointer-events-none absolute right-2.5 h-4 w-4 text-primary" />
      <ChevronDown className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={code}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        aria-label="العملة"
        className="h-9 cursor-pointer appearance-none rounded-xl border border-border bg-muted/40 pr-8 pl-7 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {CURRENCY_LIST.map((c) => (
          <option key={c.code} value={c.code}>
            {c.nameAr} ({c.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
