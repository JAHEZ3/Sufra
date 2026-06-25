import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString({ message: 'اسم التصنيف يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم التصنيف مطلوب.' })
  @MaxLength(100, { message: 'اسم التصنيف لا يتجاوز 100 حرف.' })
  name: string;

  @IsOptional()
  @IsString({ message: 'رابط الأيقونة يجب أن يكون نصاً.' })
  iconUrl?: string;
}
