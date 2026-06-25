import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

/** Input for AI menu copywriting — generate an Arabic description from minimal info. */
export class MealCopyDto {
  @IsString({ message: "اسم الصنف مطلوب." })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsNumber({}, { message: "السعر يجب أن يكون رقماً." })
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionName?: string;
}
