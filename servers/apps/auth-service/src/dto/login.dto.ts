import { IsEmail, IsMobilePhone, IsString, MinLength } from 'class-validator';

export class LoginCustomerDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;
}

export class LoginDeliveryDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  password: string;
}

/** Step 1 of the driver OTP-login fallback (account exists but has no password). */
export class DeliveryLoginOtpDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;
}

export class LoginRestaurantDto {
  @IsMobilePhone(undefined, undefined, { message: 'رقم الهاتف غير صالح.' })
  phone: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  password: string;
}

export class LoginManagerDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  email: string;

  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  @MinLength(1, { message: 'كلمة المرور مطلوبة.' })
  password: string;
}
