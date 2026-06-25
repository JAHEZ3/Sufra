export enum PaymentMethodType {
  BANK_ACCOUNT = "bank_account",
  WALLET = "wallet",
}

export enum BankName {
  BANK_OF_PALESTINE = "Bank of Palestine",
  PALESTINE_ISLAMIC_BANK = "Palestine Islamic Bank",
  ARAB_ISLAMIC_BANK = "Arab Islamic Bank",
}

export enum WalletType {
  PALPAY = "PalPay",
  JAWWAL_PAY = "Jawwal Pay",
}

export interface BankAccountPayment {
  type: PaymentMethodType.BANK_ACCOUNT;
  bankName: BankName;
  accountNumber: string;
  iban: string;
  bankPhone?: string;
}

export interface WalletPayment {
  type: PaymentMethodType.WALLET;
  walletType: WalletType;
  accountNumber: string;
  phone: string;
}

export type PaymentInfo = BankAccountPayment | WalletPayment;
