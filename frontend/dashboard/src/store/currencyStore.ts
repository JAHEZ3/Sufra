"use client";

import { create } from "zustand";
import Cookies from "js-cookie";
import { CurrencyCode, DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currency";

const COOKIE = "currency";
const COOKIE_OPTS = { expires: 365, sameSite: "strict" } as const;

/** يقرأ العملة المحفوظة من الكوكي (أو الافتراضية). يُستخدم عند التهيئة على العميل. */
export function readCurrencyCookie(): CurrencyCode {
  const v = Cookies.get(COOKIE);
  return isCurrencyCode(v) ? v : DEFAULT_CURRENCY;
}

interface CurrencyState {
  code: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  // نبدأ بالافتراضية لتطابق ما يُصيّره الخادم، ثم نُحدّثها من الكوكي بعد التحميل.
  code: DEFAULT_CURRENCY,
  setCurrency: (code) => {
    if (!isCurrencyCode(code)) return;
    Cookies.set(COOKIE, code, COOKIE_OPTS);
    set({ code });
  },
}));
