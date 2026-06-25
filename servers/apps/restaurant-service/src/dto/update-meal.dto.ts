import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Same multipart-coercion helpers as CreateMealDto. Inlined to avoid a shared
// helpers file for a two-DTO pair.
const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return value;
};

const toStringArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value === '' ? [] : [value];
    }
  }
  return value;
};

export class UpdateMealDto {
  @IsOptional()
  @IsUUID('all', { message: 'معرف القسم غير صالح.' })
  sectionId?: string;

  @IsOptional()
  @IsString({ message: 'اسم الوجبة يجب أن يكون نصاً.' })
  @MaxLength(200, { message: 'اسم الوجبة لا يتجاوز 200 حرف.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'الوصف يجب أن يكون نصاً.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'رابط الصورة يجب أن يكون نصاً.' })
  imageUrl?: string;

  @IsOptional()
  @IsNumber({}, { message: 'السعر الأساسي يجب أن يكون رقماً.' })
  @Min(0, { message: 'السعر الأساسي لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'سعر الخصم يجب أن يكون رقماً.' })
  @Min(0, { message: 'سعر الخصم لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  discountPrice?: number;

  @IsOptional()
  @IsInt({ message: 'السعرات الحرارية يجب أن تكون عدداً صحيحاً.' })
  @Min(0, { message: 'السعرات الحرارية لا يمكن أن تكون سالبة.' })
  @Type(() => Number)
  calories?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean({ message: 'حالة التوفر يجب أن تكون صح أو خطأ.' })
  isAvailable?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean({ message: 'حالة التميز يجب أن تكون صح أو خطأ.' })
  isFeatured?: boolean;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray({ message: 'الوسوم يجب أن تكون مصفوفة.' })
  @IsString({ each: true, message: 'كل وسم يجب أن يكون نصاً.' })
  tags?: string[];

  @IsOptional()
  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً.' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  displayOrder?: number;
}
