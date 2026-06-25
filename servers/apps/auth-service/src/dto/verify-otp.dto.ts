import { IsNotEmpty, IsString, Length, IsMobilePhone } from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;

  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب.' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام.' })
  otp: string;
}

export class ResendOtpDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;
}
