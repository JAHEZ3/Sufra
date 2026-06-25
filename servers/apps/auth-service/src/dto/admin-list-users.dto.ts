import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { UserRole, UserStatus } from "../entities/user.entity";

export class AdminListUsersDto {
  @IsOptional()
  @IsEnum(UserRole, { message: "الدور غير مدعوم." })
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus, { message: "الحالة غير مدعومة." })
  status?: UserStatus;

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
