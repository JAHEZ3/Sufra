"use client";

import { useEffect } from "react";
import { useCurrencyStore, readCurrencyCookie } from "@/store/currencyStore";

/** يهيّئ العملة من الكوكي بعد التحميل (لتفادي اختلاف SSR). */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  useEffect(() => {
    setCurrency(readCurrencyCookie());
  }, [setCurrency]);

  return <>{children}</>;
}
