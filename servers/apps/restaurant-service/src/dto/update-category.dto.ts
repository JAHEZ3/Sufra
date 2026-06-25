import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'اسم التصنيف يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم التصنيف لا يمكن أن يكون فارغاً.' })
  @MaxLength(100, { message: 'اسم التصنيف لا يتجاوز 100 حرف.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'رابط الأيقونة يجب أن يكون نصاً.' })
  iconUrl?: string | null;
}
