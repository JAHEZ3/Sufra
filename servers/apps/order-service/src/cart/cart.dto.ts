import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartOptionDto {
  @IsUUID()
  optionId: string;

  @IsString()
  optionName: string;

  @IsNumber()
  @Min(0)
  extraPrice: number;
}

export class AddToCartDto {
  @IsUUID()
  restaurantId: string;

  @IsString()
  restaurantName: string;

  @IsUUID()
  mealId: string;

  @IsString()
  mealName: string;

  @IsOptional()
  @IsString()
  mealImage?: string;

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
  @Type(() => CartOptionDto)
  options?: CartOptionDto[];
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
