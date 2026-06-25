import { IsEnum, IsOptional } from 'class-validator';

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class AnalyticsReportDto {
  @IsOptional()
  @IsEnum(ReportPeriod, { message: 'الفترة الزمنية غير مدعومة.' })
  period?: ReportPeriod = ReportPeriod.DAILY;
}
