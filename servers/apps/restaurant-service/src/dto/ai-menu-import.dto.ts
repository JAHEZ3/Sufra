import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ExtractedSizeDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  price?: number | null;
}

class ExtractedItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  price?: number | null;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedSizeDto)
  sizes?: ExtractedSizeDto[];
}

class ExtractedCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedItemDto)
  items: ExtractedItemDto[];
}

class ExtractedOfferDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  price?: number | null;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];
}

export class MenuExtractionDto {
  @IsOptional()
  @IsString()
  restaurantName?: string | null;

  @IsIn(["ar", "en", "mixed", "unknown"])
  language: "ar" | "en" | "mixed" | "unknown";

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsArray()
  @ArrayNotEmpty({ message: "يجب أن تحتوي القائمة على فئة واحدة على الأقل." })
  @ValidateNested({ each: true })
  @Type(() => ExtractedCategoryDto)
  categories: ExtractedCategoryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedOfferDto)
  offers?: ExtractedOfferDto[];
}

export class ApplyMenuImportDto {
  /** When set, append to this menu. Otherwise create a new one. */
  @IsOptional()
  @IsUUID("all", { message: "معرف القائمة غير صالح." })
  targetMenuId?: string;

  /** Used as the new menu's name when targetMenuId is not provided. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  menuName?: string;

  @ValidateNested()
  @Type(() => MenuExtractionDto)
  extraction: MenuExtractionDto;
}

export interface MenuImportResult {
  createdMenu: boolean;
  menuId: string;
  sectionsCreated: number;
  mealsCreated: number;
  optionGroupsCreated: number;
  optionsCreated: number;
}
