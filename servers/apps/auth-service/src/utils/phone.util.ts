/**
 * Phone normalization for the Sufra platform.
 *
 * The mobile clients let users pick a country code (+970 Palestine / +972) and
 * type a 9-digit national number. To guarantee that the SAME human always maps
 * to the SAME database row — regardless of whether they typed `0599…`,
 * `599…`, `+972599…` or `00972599…` — every phone that reaches the auth-service
 * is funnelled through `normalizePhone()` before any lookup or insert.
 *
 * Canonical form: E.164, e.g. `+970599123456` / `+972591234567`.
 *
 * Rules (Palestine / Israel-issued SIMs, the only markets this app serves):
 *   - 9 significant national digits (a leading mobile `5x…` or landline).
 *   - Default country code is +970 when the caller gives no hint.
 *   - `00` international prefix and a leading national `0` are stripped.
 */

const DEFAULT_CC = "970";
const ALLOWED_CCS = ["970", "972"] as const;
const NATIONAL_LEN = 9;

export class PhoneNormalizationError extends Error {
  constructor(message = "رقم الهاتف غير صالح.") {
    super(message);
    this.name = "PhoneNormalizationError";
  }
}

/**
 * Normalize any user-entered phone string to canonical E.164.
 * Throws {@link PhoneNormalizationError} when the result can't be a valid
 * 9-digit Palestinian/Israeli mobile number under a supported country code.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") {
    throw new PhoneNormalizationError();
  }

  // Keep digits only; remember whether the user explicitly wrote a `+`.
  const hadPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");

  // Strip the `00` international call prefix → treat as if it had a `+`.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  let cc: string | null = null;
  let national: string;

  // Explicit country code present (user typed +/00 OR the number is long enough
  // to clearly include one of our supported codes).
  const matchedCc = ALLOWED_CCS.find((c) => digits.startsWith(c));
  if ((hadPlus || digits.length > NATIONAL_LEN) && matchedCc) {
    cc = matchedCc;
    national = digits.slice(matchedCc.length);
  } else {
    national = digits;
  }

  // Drop a single leading national trunk zero (e.g. 0599…).
  national = national.replace(/^0+/, "");

  if (!cc) cc = DEFAULT_CC;

  if (national.length !== NATIONAL_LEN) {
    throw new PhoneNormalizationError();
  }
  if (!/^[1-9]\d{8}$/.test(national)) {
    throw new PhoneNormalizationError();
  }

  return `+${cc}${national}`;
}

/**
 * Non-throwing variant — returns `null` when the input can't be normalized.
 * Useful for best-effort lookups where an invalid number simply means "no user".
 */
export function tryNormalizePhone(raw: string | null | undefined): string | null {
  try {
    return normalizePhone(raw);
  } catch {
    return null;
  }
}
