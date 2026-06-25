import {
  IsEnum,
  IsISO8601,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ExpenseCategory } from "../entities/restaurant-expense.entity";

export class CreateExpenseDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // ISO date string. Defaults to now if omitted.
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class ListExpensesDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class AccountingSummaryDto {
  // Pre-set ranges keep the URL clean. Custom uses `from`/`to`.
  @IsOptional()
  @IsIn(["today", "week", "month", "custom"])
  period?: "today" | "week" | "month" | "custom";

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
