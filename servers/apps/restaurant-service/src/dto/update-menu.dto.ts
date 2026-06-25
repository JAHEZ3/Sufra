import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuDto {
  @IsOptional()
  @IsString({ message: 'اسم القائمة يجب أن يكون نصاً.' })
  @MaxLength(100, { message: 'اسم القائمة لا يتجاوز 100 حرف.' })
  name?: string;

  @IsOptional()
  @IsBoolean({ message: 'حالة القائمة يجب أن تكون صح أو خطأ.' })
  isActive?: boolean;

  @IsOptional()
  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً.' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  displayOrder?: number;
}
