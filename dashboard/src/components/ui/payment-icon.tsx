"use client";

import { useState } from "react";
import { Building2, Wallet as WalletIcon } from "lucide-react";
import { BankName, WalletType, PaymentMethodType } from "@/types/payment.types";

// Brand metadata for each method:
// - "google" methods reliably return a real favicon from Google's S2 service.
// - "initials" methods don't (Google falls back to a generic 16×16 globe),
//   so we render a branded colored circle with the brand's initial instead.
type BrandKind =
  | { kind: "google"; domain: string }
  | { kind: "initials"; initials: string; bg: string; fg: string };

const BANK_BRAND: Record<BankName, BrandKind> = {
  [BankName.BANK_OF_PALESTINE]: { kind: "google", domain: "bankofpalestine.com" },
  [BankName.PALESTINE_ISLAMIC_BANK]: { kind: "google", domain: "islamicbank.ps" },
  [BankName.ARAB_ISLAMIC_BANK]: { kind: "initials", initials: "AIB", bg: "#0E6BAC", fg: "#FFFFFF" },
};

const WALLET_BRAND: Record<WalletType, BrandKind> = {
  [WalletType.PALPAY]: { kind: "initials", initials: "PP", bg: "#1f8a5b", fg: "#FFFFFF" },
  [WalletType.JAWWAL_PAY]: { kind: "initials", initials: "JP", bg: "#00A651", fg: "#FFFFFF" },
};

export function bankIconUrl(bank: BankName, size = 64): string | null {
  const b = BANK_BRAND[bank];
  return b.kind === "google"
    ? `https://www.google.com/s2/favicons?domain=${b.domain}&sz=${size}`
    : null;
}

export function walletIconUrl(wallet: WalletType, size = 64): string | null {
  const w = WALLET_BRAND[wallet];
  return w.kind === "google"
    ? `https://www.google.com/s2/favicons?domain=${w.domain}&sz=${size}`
    : null;
}

interface Props {
  type: PaymentMethodType;
  bank?: BankName;
  wallet?: WalletType;
  size?: number;
  className?: string;
}

function InitialsCircle({
  initials, bg, fg, size, className = "",
}: {
  initials: string; bg: string; fg: string; size: number; className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        lineHeight: 1,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </span>
  );
}

export function PaymentMethodIcon({
  type, bank, wallet, size = 28, className = "",
}: Props) {
  const [errored, setErrored] = useState(false);

  const brand: BrandKind | null =
    type === PaymentMethodType.BANK_ACCOUNT && bank
      ? BANK_BRAND[bank]
      : type === PaymentMethodType.WALLET && wallet
        ? WALLET_BRAND[wallet]
        : null;

  if (!brand) {
    const Fallback = type === PaymentMethodType.BANK_ACCOUNT ? Building2 : WalletIcon;
    return (
      <Fallback
        className={`text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (brand.kind === "initials" || errored) {
    const fallback =
      brand.kind === "initials"
        ? brand
        : { initials: "?", bg: "#9CA3AF", fg: "#FFFFFF" };
    return (
      <InitialsCircle
        initials={fallback.initials}
        bg={fallback.bg}
        fg={fallback.fg}
        size={size}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${brand.domain}&sz=${size * 2}`}
      alt=""
      width={size}
      height={size}
      onError={() => setErrored(true)}
      referrerPolicy="no-referrer"
      className={`rounded ${className}`}
    />
  );
}
