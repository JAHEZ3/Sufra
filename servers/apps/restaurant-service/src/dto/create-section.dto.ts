import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSectionDto {
  @IsString({ message: 'اسم القسم يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم القسم مطلوب.' })
  @MaxLength(100, { message: 'اسم القسم لا يتجاوز 100 حرف.' })
  name: string;

  @IsOptional()
  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً.' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  displayOrder?: number;
}
