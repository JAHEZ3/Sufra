import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuSelectionType } from '../entities/meal-option-group.entity';

export class UpdateOptionGroupDto {
  @IsOptional()
  @IsString({ message: 'اسم المجموعة يجب أن يكون نصاً.' })
  @MaxLength(100, { message: 'اسم المجموعة لا يتجاوز 100 حرف.' })
  name?: string;

  @IsOptional()
  @IsEnum(MenuSelectionType, { message: 'نوع الاختيار غير مدعوم.' })
  selectionType?: MenuSelectionType;

  @IsOptional()
  @IsBoolean({ message: 'حقل الإلزامية يجب أن يكون صح أو خطأ.' })
  isRequired?: boolean;

  @IsOptional()
  @IsInt({ message: 'الحد الأقصى للاختيارات يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'الحد الأقصى للاختيارات يجب أن يكون 1 على الأقل.' })
  @Type(() => Number)
  maxSelections?: number;
}
