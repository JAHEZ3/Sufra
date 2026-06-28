"use client";

import { useCallback } from "react";
import { useCurrencyStore } from "@/store/currencyStore";
import { CURRENCIES, formatMoney, formatMoneyDecimal } from "@/lib/currency";

/**
 * يعطي العملة المختارة ودوال التنسيق المرتبطة بها.
 * استبدل أي تنسيق ثابت لـ "ر.س" بـ format() من هذا الـ hook.
 */
export function useCurrency() {
  const code = useCurrencyStore((s) => s.code);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const def = CURRENCIES[code];

  const format = useCallback((n: number) => formatMoney(n, code), [code]);
  const formatDecimal = useCallback(
    (n: number, digits?: number) => formatMoneyDecimal(n, code, digits),
    [code],
  );

  return { code, def, symbol: def.symbol, setCurrency, format, formatDecimal };
}
