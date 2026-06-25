import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsUUID('all', { message: 'المعرف غير صالح.' })
  id: string;

  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً.' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يكون سالباً.' })
  @Type(() => Number)
  displayOrder: number;
}

export class ReorderDto {
  @IsArray({ message: 'قائمة العناصر يجب أن تكون مصفوفة.' })
  @ArrayNotEmpty({ message: 'قائمة العناصر لا يمكن أن تكون فارغة.' })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
