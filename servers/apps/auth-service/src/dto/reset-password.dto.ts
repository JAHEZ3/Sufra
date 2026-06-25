import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MinLength, IsMobilePhone } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email?: string;

  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب.' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام.' })
  otp: string;

  @IsString({ message: 'كلمة المرور الجديدة يجب أن تكون نصاً.' })
  @MinLength(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' })
  newPassword: string;
}
