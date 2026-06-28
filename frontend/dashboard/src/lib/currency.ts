// ─── العملات المدعومة ──────────────────────────────────────────────────────────
// نظام عملة ديناميكي: يمكن للمطعم اختيار عملته وتُطبَّق على كل المبالغ في اللوحة.

export type CurrencyCode = "SAR" | "ILS" | "USD" | "AED" | "EGP";

export interface CurrencyDef {
  code: CurrencyCode;
  symbol: string;
  nameAr: string;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  SAR: { code: "SAR", symbol: "ر.س", nameAr: "ريال سعودي", locale: "en-US" },
  ILS: { code: "ILS", symbol: "₪", nameAr: "شيكل", locale: "en-US" },
  USD: { code: "USD", symbol: "$", nameAr: "دولار أمريكي", locale: "en-US" },
  AED: { code: "AED", symbol: "د.إ", nameAr: "درهم إماراتي", locale: "en-US" },
  EGP: { code: "EGP", symbol: "ج.م", nameAr: "جنيه مصري", locale: "en-US" },
};

export const CURRENCY_LIST: CurrencyDef[] = Object.values(CURRENCIES);

export const DEFAULT_CURRENCY: CurrencyCode = "SAR";

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && v in CURRENCIES;
}

/** تنسيق مبلغ بدون كسور — مثال: "1,250 ر.س" */
export function formatMoney(amount: number, code: CurrencyCode): string {
  const def = CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
  return `${Math.round(amount ?? 0).toLocaleString(def.locale)} ${def.symbol}`;
}

/** تنسيق مبلغ بكسور عشرية — مثال: "1,250.00 ر.س" */
export function formatMoneyDecimal(amount: number, code: CurrencyCode, digits = 2): string {
  const def = CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
  return `${(amount ?? 0).toLocaleString(def.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${def.symbol}`;
}
