import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { UserRole } from '../entities/user.read';

export class SendBroadcastDto {
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

  // Optional role filter — when omitted, sends to every active user.
  @IsOptional()
  @IsEnum(UserRole, { message: 'الدور غير مدعوم.' })
  role?: UserRole;
}
