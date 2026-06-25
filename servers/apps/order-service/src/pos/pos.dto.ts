import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { LocalServiceType, PaymentMethod } from '../entities/order-enums';

export class PosItemOptionDto {
  @IsUUID()
  optionId: string;

  @IsString()
  optionName: string;

  @IsNumber()
  @Min(0)
  extraPrice: number;
}

export class PosItemDto {
  @IsUUID()
  mealId: string;

  @IsString()
  mealName: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosItemOptionDto)
  options?: PosItemOptionDto[];
}

export class CreatePosOrderDto {
  @IsUUID()
  restaurantId: string;

  @IsString()
  restaurantName: string;

  @IsEnum(LocalServiceType)
  serviceType: LocalServiceType;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  // Set when staff picks a registered table from the dropdown; resolved
  // server-side when a customer scans a QR.
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosItemDto)
  items: PosItemDto[];
}

export class ScanOrderDto {
  @IsString()
  qrToken: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosItemDto)
  items: PosItemDto[];
}

export class UpdatePosItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class SetDiscountDto {
  // Absolute amount to subtract from subtotal
  @IsNumber()
  @Min(0)
  discountAmount: number;
}

export class AddPaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  // Captured for online/card payments — provider txn id, payer-on-card, and
  // the timestamp the cashier recorded. All optional; only used when method
  // is ONLINE or CARD but accepted on any method.
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  payerName?: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}

export class UpdatePaymentSplitDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  payerName?: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}

export class ClosePosOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  // If no split payments were recorded earlier, you can pay the whole bill in one go here
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  // Optional metadata for the auto-generated final split when closing a bill
  // that wasn't fully covered by earlier split payments.
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  payerName?: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}

export class VoidPosOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
