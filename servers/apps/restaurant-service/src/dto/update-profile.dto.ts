import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsMobilePhone,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'اسم المطعم يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم المطعم لا يمكن أن يكون فارغاً.' })
  @MaxLength(200, { message: 'اسم المطعم لا يتجاوز 200 حرف.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'الوصف يجب أن يكون نصاً.' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'رابط الشعار يجب أن يكون نصاً.' })
  logoUrl?: string;

  @IsOptional()
  @IsString({ message: 'رابط الغلاف يجب أن يكون نصاً.' })
  coverUrl?: string;

  @IsOptional()
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'العنوان يجب أن يكون نصاً.' })
  street?: string;

  @IsOptional()
  @IsString({ message: 'المدينة يجب أن تكون نصاً.' })
  @MaxLength(100, { message: 'اسم المدينة لا يتجاوز 100 حرف.' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'نوع المطبخ يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'نوع المطبخ لا يمكن أن يكون فارغاً.' })
  @MaxLength(100, { message: 'نوع المطبخ لا يتجاوز 100 حرف.' })
  cuisineType?: string;
}
