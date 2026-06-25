import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum RestaurantReviewSort {
  LATEST = 'latest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

/**
 * Query for GET /api/restaurant/analytics/restaurant-reviews.
 * Paginated + sortable list of standalone customer ratings (restaurant_ratings).
 */
export class ListRestaurantReviewsDto {
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

  @IsOptional()
  @IsEnum(RestaurantReviewSort, {
    message: 'sort يجب أن يكون latest أو highest أو lowest.',
  })
  sort?: RestaurantReviewSort = RestaurantReviewSort.LATEST;
}
