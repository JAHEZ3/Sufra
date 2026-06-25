import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOptionDto {
  @IsOptional()
  @IsString({ message: 'اسم الخيار يجب أن يكون نصاً.' })
  @MaxLength(100, { message: 'اسم الخيار لا يتجاوز 100 حرف.' })
  name?: string;

  @IsOptional()
  @IsNumber({}, { message: 'السعر الإضافي يجب أن يكون رقماً.' })
  @Min(0, { message: 'السعر الإضافي لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  extraPrice?: number;

  @IsOptional()
  @IsBoolean({ message: 'حالة التوفر يجب أن تكون صح أو خطأ.' })
  isAvailable?: boolean;
}
