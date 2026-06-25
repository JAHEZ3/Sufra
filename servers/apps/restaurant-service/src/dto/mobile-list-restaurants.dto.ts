import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MobileListRestaurantsDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString({ message: 'نوع المطبخ يجب أن يكون نصاً.' })
  cuisineType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'page يجب أن يكون 1 على الأقل.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'limit يجب أن يكون 1 على الأقل.' })
  @Max(50, { message: 'limit لا يمكن أن يتجاوز 50.' })
  limit?: number = 10;
}
