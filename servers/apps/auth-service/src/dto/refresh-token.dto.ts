import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'رمز التحديث يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رمز التحديث مطلوب.' })
  refreshToken: string;
}
