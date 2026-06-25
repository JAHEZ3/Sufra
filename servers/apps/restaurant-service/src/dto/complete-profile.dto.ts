import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class CompleteRestaurantProfileDto {
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً.' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' })
  password: string;

  @IsString({ message: 'اسم المطعم يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم المطعم مطلوب.' })
  restaurantName: string;

  @IsString({ message: 'اسم المالك يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'اسم المالك مطلوب.' })
  ownerName: string;

  @IsString({ message: 'رقم الهوية يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رقم الهوية مطلوب.' })
  ownerNationalIdNumber: string;

  @IsString({ message: 'رقم السجل التجاري يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رقم السجل التجاري مطلوب.' })
  commercialRegNumber: string;

  @IsString({ message: 'رقم هاتف المطعم يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'رقم هاتف المطعم مطلوب.' })
  restaurantPhone: string;

  @IsOptional()
  @IsString({ message: 'الوصف يجب أن يكون نصاً.' })
  description?: string;

  @IsString({ message: 'العنوان يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'العنوان مطلوب.' })
  street: string;

  @IsString({ message: 'المدينة يجب أن تكون نصاً.' })
  @IsNotEmpty({ message: 'المدينة مطلوبة.' })
  city: string;

  @IsString({ message: 'نوع المطبخ يجب أن يكون نصاً.' })
  @IsNotEmpty({ message: 'نوع المطبخ مطلوب.' })
  @MaxLength(100, { message: 'نوع المطبخ لا يتجاوز 100 حرف.' })
  cuisineType: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'خط العرض يجب أن يكون رقماً.' })
  @Min(-90, { message: 'خط العرض يجب أن يكون بين -90 و 90.' })
  @Max(90, { message: 'خط العرض يجب أن يكون بين -90 و 90.' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'خط الطول يجب أن يكون رقماً.' })
  @Min(-180, { message: 'خط الطول يجب أن يكون بين -180 و 180.' })
  @Max(180, { message: 'خط الطول يجب أن يكون بين -180 و 180.' })
  lng?: number;

  @IsString({ message: 'معلومات الدفع مطلوبة.' })
  @IsNotEmpty({ message: 'معلومات الدفع مطلوبة.' })
  paymentInfo: string;

  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean({ message: 'يجب قبول الشروط والأحكام.' })
  termsAccepted: boolean;
}
