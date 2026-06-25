import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { InventoryUnit } from "../entities/inventory-item.entity";
import { MovementType } from "../entities/inventory-movement.entity";

export class CreateInventoryItemDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sku?: string;

  @IsEnum(InventoryUnit)
  unit: InventoryUnit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sku?: string;

  @IsOptional()
  @IsEnum(InventoryUnit)
  unit?: InventoryUnit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Adds/removes stock. `quantity` here is the ABSOLUTE amount; the service
 * applies the sign based on `type`. Adjustments accept a separate signed
 * delta.
 */
export class RecordMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  // For IN / OUT: positive amount (sign applied by type). For ADJUSTMENT:
  // signed delta (-2 to remove two from waste, +1 to add one).
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
