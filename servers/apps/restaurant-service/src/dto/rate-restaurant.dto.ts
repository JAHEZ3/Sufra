import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for POST /api/restaurant/restaurants/:id/rate
 *
 *   { "rating": 5, "comment": "Amazing food and service" }
 *
 * `rating` is a required integer 1..5. `comment` is optional free text; we trim
 * it and collapse an empty string to `undefined` so blank comments don't persist
 * as empty rows. Length is capped to keep the column bounded and abuse low.
 */
export class RateRestaurantDto {
  @IsInt({ message: 'التقييم يجب أن يكون رقماً صحيحاً.' })
  @Min(1, { message: 'التقييم يجب أن يكون 1 على الأقل.' })
  @Max(5, { message: 'التقييم يجب ألا يتجاوز 5.' })
  rating: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'التعليق يجب أن يكون نصاً.' })
  @MaxLength(500, { message: 'التعليق يجب ألا يتجاوز 500 حرف.' })
  comment?: string;
}
