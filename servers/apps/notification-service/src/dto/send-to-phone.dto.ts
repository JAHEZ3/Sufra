import {
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class SendToPhoneDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/, { message: 'رقم الهاتف غير صالح.' })
  phone: string;

  @IsString()
  @Length(1, 60, { message: 'النوع مطلوب (60 حرفاً كحد أقصى).' })
  type: string;

  @IsString()
  @Length(1, 200, { message: 'العنوان مطلوب (200 حرف كحد أقصى).' })
  title: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject({ message: 'الحقل data يجب أن يكون كائناً.' })
  data?: Record<string, unknown>;
}
