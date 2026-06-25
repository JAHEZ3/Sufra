import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class HourEntryDto {
  @IsInt({ message: 'يوم الأسبوع يجب أن يكون رقماً صحيحاً.' })
  @Min(0, { message: 'يوم الأسبوع يجب أن يكون بين 0 (الأحد) و 6 (السبت).' })
  @Max(6, { message: 'يوم الأسبوع يجب أن يكون بين 0 (الأحد) و 6 (السبت).' })
  dayOfWeek: number;

  @IsString({ message: 'وقت الفتح يجب أن يكون نصاً.' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'وقت الفتح يجب أن يكون بتنسيق HH:MM.' })
  openTime: string;

  @IsString({ message: 'وقت الإغلاق يجب أن يكون نصاً.' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'وقت الإغلاق يجب أن يكون بتنسيق HH:MM.' })
  closeTime: string;
}

export class SetHoursDto {
  @IsArray({ message: 'أوقات العمل يجب أن تكون مصفوفة.' })
  @ArrayMinSize(7, { message: 'يجب إرسال أوقات العمل لجميع أيام الأسبوع (7 أيام).' })
  @ArrayMaxSize(7, { message: 'يجب إرسال أوقات العمل لجميع أيام الأسبوع (7 أيام).' })
  @ArrayUnique((o: HourEntryDto) => o.dayOfWeek, {
    message: 'لا يجوز تكرار يوم الأسبوع في أوقات العمل.',
  })
  @ValidateNested({ each: true })
  @Type(() => HourEntryDto)
  hours: HourEntryDto[];
}
