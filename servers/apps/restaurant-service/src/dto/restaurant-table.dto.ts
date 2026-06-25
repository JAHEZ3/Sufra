import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateTableDto {
  @IsString()
  @Length(1, 50)
  number: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  section?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  number?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  section?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
