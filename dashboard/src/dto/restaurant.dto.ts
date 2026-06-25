export interface UpdateRestaurantDto {
  name?: string;
  description?: string;
  phone?: string;
  street?: string;
  city?: string;
  logoUrl?: string;
  coverUrl?: string;
  cuisineType?: string;
}

import type { PaymentInfo } from "@/types/payment.types";

export interface UpdateSettingsDto {
  lat?: number;
  lng?: number;
  minOrderAmount?: number;
  currencyType?: string;
  paymentInfo?: PaymentInfo;
  // ESC/POS thermal printers (LAN). Pass null to clear, omit to leave alone.
  kitchenPrinterIp?: string | null;
  kitchenPrinterPort?: number;
  cashierPrinterIp?: string | null;
  cashierPrinterPort?: number;
}

export interface UpdateStoreStatusDto {
  isOpen: boolean;
}

export interface RestaurantHourEntryDto {
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  openTime: string;  // "HH:MM"
  closeTime: string; // "HH:MM"
}

export interface SetRestaurantHoursDto {
  hours: RestaurantHourEntryDto[]; // must contain all 7 days
}
