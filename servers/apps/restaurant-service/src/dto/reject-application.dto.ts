import { IsOptional, IsString } from 'class-validator';

export class RejectApplicationDto {
  @IsOptional()
  @IsString({ message: 'سبب الرفض يجب أن يكون نصاً.' })
  reason?: string;
}
