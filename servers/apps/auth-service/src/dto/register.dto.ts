import {
  IsEmail,
  IsMobilePhone,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterRestaurantDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' })
  password: string;

  @IsString({ message: 'اسم المطعم يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم المطعم مطلوب.' })
  restaurantName: string;
}

export class RegisterManagerDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' })
  password: string;

  @IsString({ message: 'الاسم الكامل يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'الاسم الكامل مطلوب.' })
  fullName: string;
}
