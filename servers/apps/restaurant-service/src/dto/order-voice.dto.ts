import { IsOptional, IsString, MaxLength } from "class-validator";

/** Input for an Arabic order-status voice announcement (ElevenLabs TTS). */
export class OrderVoiceDto {
  @IsString({ message: "حالة الطلب مطلوبة." })
  @MaxLength(40)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderNumber?: string;
}
