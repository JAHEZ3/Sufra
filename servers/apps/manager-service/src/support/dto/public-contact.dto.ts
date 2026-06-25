import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CONTACT_SUBJECTS = [
  'general',
  'order_issue',
  'restaurant_join',
  'driver_join',
  'complaint',
  'other',
] as const;

export class PublicContactDto {
  @IsString({ message: 'الاسم مطلوب.' })
  @MinLength(2, { message: 'الاسم قصير جداً.' })
  @MaxLength(200, { message: 'الاسم طويل جداً.' })
  name: string;

  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح.' })
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+0-9\s()-]{6,30}$/, { message: 'رقم الهاتف غير صالح.' })
  phone?: string;

  @IsOptional()
  @IsEnum(CONTACT_SUBJECTS, { message: 'نوع الموضوع غير صالح.' })
  subject?: (typeof CONTACT_SUBJECTS)[number];

  @IsString()
  @MinLength(3, { message: 'الموضوع قصير جداً.' })
  @MaxLength(200, { message: 'الموضوع طويل جداً.' })
  title: string;

  @IsString()
  @MinLength(10, { message: 'يرجى كتابة تفاصيل أكثر.' })
  @MaxLength(2000, { message: 'الرسالة طويلة جداً.' })
  message: string;
}
