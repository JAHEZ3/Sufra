import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export class UpdateSupportTicketStatusDto {
  @IsEnum(STATUSES, { message: 'الحالة غير صالحة.' })
  status: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}
