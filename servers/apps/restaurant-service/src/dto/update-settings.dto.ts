import {
  IsIP,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

const SUPPORTED_CURRENCIES = ['SAR', 'ILS', 'USD', 'AED', 'EGP'];

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES, { message: 'العملة غير مدعومة.' })
  currencyType?: string;

  @IsOptional()
  @IsNumber({}, { message: 'خط العرض يجب أن يكون رقماً.' })
  @IsPositive({ message: 'خط العرض يجب أن يكون موجباً.' })
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber({}, { message: 'خط الطول يجب أن يكون رقماً.' })
  @IsPositive({ message: 'خط الطول يجب أن يكون موجباً.' })
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber({}, { message: 'نطاق التوصيل يجب أن يكون رقماً.' })
  @Min(0, { message: 'نطاق التوصيل لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsNumber({}, { message: 'الحد الأدنى للطلب يجب أن يكون رقماً.' })
  @Min(0, { message: 'الحد الأدنى للطلب لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'وقت التوصيل يجب أن يكون رقماً.' })
  @Min(1, { message: 'وقت التوصيل يجب أن يكون دقيقة واحدة على الأقل.' })
  @Type(() => Number)
  avgDeliveryMinutes?: number;

  // Validated structurally in the service via validatePaymentInfo()
  @IsOptional()
  @IsObject({ message: 'بيانات الدفع غير صحيحة.' })
  paymentInfo?: Record<string, unknown>;

  // ─── Thermal printers (ESC/POS over TCP) ─────────────────────────────
  // Empty string clears the IP (disables that printer). Validate as IP
  // only when the value is a non-empty string.
  @IsOptional()
  @ValidateIf((_, v) => typeof v === "string" && v.length > 0)
  @IsIP(undefined, { message: 'عنوان IP لطابعة المطبخ غير صحيح.' })
  kitchenPrinterIp?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  kitchenPrinterPort?: number;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === "string" && v.length > 0)
  @IsIP(undefined, { message: 'عنوان IP لطابعة الكاشير غير صحيح.' })
  cashierPrinterIp?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  cashierPrinterPort?: number;
}
