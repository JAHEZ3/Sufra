import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRestaurantsDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'page يجب أن يكون 1 على الأقل.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'limit يجب أن يكون 1 على الأقل.' })
  @Max(100, { message: 'limit لا يمكن أن يتجاوز 100.' })
  limit?: number = 10;
}
