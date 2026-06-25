import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page يجب أن يكون رقماً صحيحاً.' })
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit يجب أن يكون رقماً صحيحاً.' })
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
