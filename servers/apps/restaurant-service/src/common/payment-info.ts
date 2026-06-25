export enum PaymentMethodType {
  BANK_ACCOUNT = 'bank_account',
  WALLET = 'wallet',
}

export enum BankName {
  BANK_OF_PALESTINE = 'Bank of Palestine',
  PALESTINE_ISLAMIC_BANK = 'Palestine Islamic Bank',
  ARAB_ISLAMIC_BANK = 'Arab Islamic Bank',
}

export enum WalletType {
  PALPAY = 'PalPay',
  JAWWAL_PAY = 'Jawwal Pay',
}

export interface BankAccountPayment {
  type: PaymentMethodType.BANK_ACCOUNT;
  bankName: BankName;
  accountNumber: string;
  iban: string;
  bankPhone?: string; // optional
  qrImageUrl?: string; // S3 key on the database; presigned URL on responses
}

export interface WalletPayment {
  type: PaymentMethodType.WALLET;
  walletType: WalletType;
  accountNumber: string;
  phone: string; // required for wallet
  qrImageUrl?: string;
}

export type PaymentInfo = BankAccountPayment | WalletPayment;

// ─── Validation helpers (used by the service) ──────────────────────────────

export function validatePaymentInfo(parsed: unknown): PaymentInfo {
  const p = parsed as Record<string, any> | null;
  if (!p || typeof p !== 'object') {
    throw new Error('paymentInfo must be an object');
  }

  if (p.type === PaymentMethodType.BANK_ACCOUNT) {
    if (!Object.values(BankName).includes(p.bankName)) {
      throw new Error(
        `bankName must be one of: ${Object.values(BankName).join(', ')}`,
      );
    }
    if (!p.accountNumber?.trim())
      throw new Error('accountNumber is required for bank account');
    if (!p.iban?.trim())
      throw new Error('iban is required for bank account');

    return {
      type: PaymentMethodType.BANK_ACCOUNT,
      bankName: p.bankName as BankName,
      accountNumber: p.accountNumber,
      iban: p.iban,
      ...(p.bankPhone ? { bankPhone: p.bankPhone } : {}),
      ...(typeof p.qrImageUrl === 'string' && p.qrImageUrl ? { qrImageUrl: p.qrImageUrl } : {}),
    };
  }

  if (p.type === PaymentMethodType.WALLET) {
    if (!Object.values(WalletType).includes(p.walletType)) {
      throw new Error(
        `walletType must be one of: ${Object.values(WalletType).join(', ')}`,
      );
    }
    if (!p.accountNumber?.trim())
      throw new Error('accountNumber is required for wallet');
    if (!p.phone?.trim())
      throw new Error('phone is required for wallet');

    return {
      type: PaymentMethodType.WALLET,
      walletType: p.walletType as WalletType,
      accountNumber: p.accountNumber,
      phone: p.phone,
      ...(typeof p.qrImageUrl === 'string' && p.qrImageUrl ? { qrImageUrl: p.qrImageUrl } : {}),
    };
  }

  throw new Error(
    `paymentInfo.type must be '${PaymentMethodType.BANK_ACCOUNT}' or '${PaymentMethodType.WALLET}'`,
  );
}

export function parseAndValidatePaymentInfo(raw: string): PaymentInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('paymentInfo must be valid JSON');
  }
  return validatePaymentInfo(parsed);
}
