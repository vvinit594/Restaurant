import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
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

export class RegisterDeviceDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  publicId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  secret?: string;
}

export class SavePushSubscriptionDto {
  @IsString()
  @MinLength(8)
  endpoint!: string;

  @IsString()
  @MinLength(8)
  p256dh!: string;

  @IsString()
  @MinLength(8)
  auth!: string;
}

export class UpdateCustomerProfileDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  displayName?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;

  @Transform(({ value }) =>
    value == null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toLowerCase(),
  )
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CustomerListQueryDto {
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

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['unread', 'read', 'all'])
  filter?: string;
}

export class ApplyCouponQueryDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  couponCode?: string;
}
