import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeneralSettingsDto {
  @IsOptional() @IsString()
  platformName?: string;

  @IsOptional() @IsString()
  supportEmail?: string;

  @IsOptional() @IsString()
  supportPhone?: string;

  @IsOptional() @IsString()
  supportWhatsapp?: string;

  @IsOptional() @IsString()
  supportAddress?: string;

  @IsOptional() @IsString()
  supportHours?: string;

  @IsOptional() @IsString()
  defaultLanguage?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsString()
  logoUrl?: string;

  // ─── Social media URLs (send null or "" to clear) ─────────────────────
  @IsOptional() @IsString() facebookUrl?: string | null;
  @IsOptional() @IsString() instagramUrl?: string | null;
  @IsOptional() @IsString() xUrl?: string | null;
  @IsOptional() @IsString() youtubeUrl?: string | null;
  @IsOptional() @IsString() tiktokUrl?: string | null;
  @IsOptional() @IsString() snapchatUrl?: string | null;

  // ─── App store URLs ───────────────────────────────────────────────────
  @IsOptional() @IsString() appStoreUrl?: string | null;
  @IsOptional() @IsString() googlePlayUrl?: string | null;

  // ─── Public website CTA button URLs ───────────────────────────────────
  @IsOptional() @IsString() restaurantSignupUrl?: string | null;
  @IsOptional() @IsString() driverSignupUrl?: string | null;
  @IsOptional() @IsString() appDownloadUrl?: string | null;

  // ─── SEO metadata (title template, description, OG image URL) ─────────
  @IsOptional() @IsString() seoTitleTemplate?: string | null;
  @IsOptional() @IsString() seoDescription?: string | null;
  @IsOptional() @IsString() seoOgImageUrl?: string | null;
}

export class FeesSettingsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(50)
  restaurantCommission?: number;

  @IsOptional() @IsNumber() @Min(0)
  deliveryFeeBase?: number;

  @IsOptional() @IsNumber() @Min(0)
  deliveryFeePerKm?: number;

  @IsOptional() @IsNumber() @Min(0)
  minOrderAmount?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(30)
  taxRate?: number;
}

export class DeliverySettingsDto {
  @IsOptional() @IsNumber() @Min(1)
  maxDeliveryRadius?: number;

  @IsOptional() @IsNumber() @Min(5)
  estimatedTimeMin?: number;

  @IsOptional() @IsNumber() @Min(10)
  estimatedTimeMax?: number;

  @IsOptional() @IsBoolean()
  allowScheduledOrders?: boolean;
}

export class NotificationSettingsDto {
  @IsOptional() @IsBoolean() enableEmailNotifications?: boolean;
  @IsOptional() @IsBoolean() enableSmsNotifications?: boolean;
  @IsOptional() @IsBoolean() enablePushNotifications?: boolean;
  @IsOptional() @IsBoolean() orderUpdatesEnabled?: boolean;
  @IsOptional() @IsBoolean() marketingEnabled?: boolean;
}

export class SystemSettingsDto {
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsBoolean() allowNewRegistrations?: boolean;
  @IsOptional() @IsBoolean() allowNewRestaurants?: boolean;
  @IsOptional() @IsBoolean() requireRestaurantApproval?: boolean;
  @IsOptional() @IsBoolean() requireDriverApproval?: boolean;
  @IsOptional() @IsBoolean() enableRatings?: boolean;
  @IsOptional() @IsBoolean() enableReviews?: boolean;
}

export class PaymentSettingsDto {
  @IsOptional() @IsBoolean() enableCreditCard?: boolean;
  @IsOptional() @IsBoolean() enableApplePay?: boolean;
  @IsOptional() @IsBoolean() enableCashOnDelivery?: boolean;
  @IsOptional() @IsBoolean() enableWallet?: boolean;
  @IsOptional() @IsNumber() @Min(0) maxWalletBalance?: number;
}

export class UpdateSettingsDto {
  @IsOptional() @ValidateNested() @Type(() => GeneralSettingsDto)
  general?: GeneralSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => FeesSettingsDto)
  fees?: FeesSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => DeliverySettingsDto)
  delivery?: DeliverySettingsDto;

  @IsOptional() @ValidateNested() @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => SystemSettingsDto)
  system?: SystemSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => PaymentSettingsDto)
  payment?: PaymentSettingsDto;
}
