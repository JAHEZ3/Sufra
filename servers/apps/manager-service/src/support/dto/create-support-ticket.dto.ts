import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUBJECTS = [
  'general',
  'technical',
  'billing',
  'partnership',
  'other',
] as const;

export const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

export class CreateSupportTicketDto {
  @IsOptional()
  @IsEnum(SUBJECTS, { message: 'نوع الطلب غير صالح.' })
  subject?: (typeof SUBJECTS)[number];

  @IsOptional()
  @IsEnum(PRIORITIES, { message: 'الأولوية غير صالحة.' })
  priority?: (typeof PRIORITIES)[number];

  @IsString()
  @MinLength(3, { message: 'العنوان قصير جداً.' })
  @MaxLength(200, { message: 'العنوان طويل جداً.' })
  title: string;

  @IsString()
  @MinLength(10, { message: 'يرجى كتابة تفاصيل أكثر.' })
  @MaxLength(2000, { message: 'الرسالة طويلة جداً.' })
  message: string;
}
