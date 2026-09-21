import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export class EngagementCustomerQueryDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  search?: string;

  @Transform(({ value }) => String(value || 'all').trim().toUpperCase())
  @IsOptional()
  @IsIn(['ALL', 'PREVIOUSLY_ORDERED'])
  targeting?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CreateCouponDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => String(value || '').trim().toUpperCase())
  @IsIn(['PERCENT', 'FIXED'])
  discountType!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue!: number;

  @IsString()
  @MinLength(3)
  code!: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumOrderValue?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumDiscount?: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  startsAt?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}

export class SendPushNotificationDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  message!: string;

  @Transform(({ value }) => String(value || 'ALL_ELIGIBLE').trim().toUpperCase())
  @IsIn(['ALL_ELIGIBLE', 'PREVIOUSLY_ORDERED', 'INDIVIDUAL'])
  targeting!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  customerIds?: string[];

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  couponId?: string;
}
