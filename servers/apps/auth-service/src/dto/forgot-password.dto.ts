import { IsEmail, IsMobilePhone, ValidateIf } from 'class-validator';

export class ForgotPasswordDto {
  @ValidateIf((o) => !o.email)
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone?: string;

  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email?: string;
}
