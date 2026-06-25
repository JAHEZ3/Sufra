import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DiscountType } from '../entities/order-enums';

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountCap?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  validFrom?: string;

  @IsOptional()
  validUntil?: string;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @IsOptional()
  @IsNumber()
  maxDiscountCap?: number;

  @IsOptional()
  validUntil?: string;
}

export class ValidatePromoDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  orderAmount: number;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;
}
