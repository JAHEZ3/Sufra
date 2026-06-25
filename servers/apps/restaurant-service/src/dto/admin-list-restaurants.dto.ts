import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { RestaurantStatus } from "../entities/restaurant.entity";

export class AdminListRestaurantsDto {
  @IsOptional()
  @IsEnum(RestaurantStatus, { message: "حالة المطعم غير مدعومة." })
  status?: RestaurantStatus;

  @IsOptional()
  @IsString({ message: "نوع المطبخ يجب أن يكون نصاً." })
  cuisineType?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page يجب أن يكون رقماً صحيحاً." })
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit يجب أن يكون رقماً صحيحاً." })
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
