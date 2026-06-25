import { IsEnum } from "class-validator";
import { UserStatus } from "../entities/user.entity";

export class AdminChangeStatusDto {
  @IsEnum(UserStatus, { message: "الحالة غير مدعومة." })
  status: UserStatus;
}
