import { IsOptional, IsString, Matches } from 'class-validator';

export class GenerateCoverDto {
  /**
   * Optional override for the brand accent color. When omitted, the service
   * samples the dominant color from the restaurant's logo via a vision LLM.
   */
  @IsOptional()
  @IsString()
  @Matches(/^#?[0-9a-fA-F]{6}$/, {
    message: 'يجب أن يكون اللون بصيغة سداسية (مثال: #E2552B).',
  })
  accentColor?: string;
}
