import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'كلمة المرور الحالية يجب أن تكون نصاً.' })
  oldPassword: string;

  @IsString({ message: 'كلمة المرور الجديدة يجب أن تكون نصاً.' })
  @MinLength(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' })
  newPassword: string;
}
