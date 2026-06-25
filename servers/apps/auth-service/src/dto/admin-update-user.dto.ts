import {
  IsEmail,
  IsMobilePhone,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString({ message: "الاسم يجب أن يكون نصاً." })
  @MaxLength(255, { message: "الاسم لا يتجاوز 255 حرف." })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: "البريد الإلكتروني غير صالح." })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsMobilePhone(undefined, undefined, { message: "رقم الهاتف غير صالح." })
  phone?: string;
}
