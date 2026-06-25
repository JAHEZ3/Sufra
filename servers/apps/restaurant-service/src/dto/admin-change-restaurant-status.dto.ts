import { IsEnum } from "class-validator";
import { RestaurantStatus } from "../entities/restaurant.entity";

export class AdminChangeRestaurantStatusDto {
  @IsEnum(RestaurantStatus, { message: "حالة المطعم غير مدعومة." })
  status: RestaurantStatus;
}
