import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
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

export class LoyaltyCustomerListQueryDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  search?: string;

  @Transform(({ value }) => String(value || 'all').trim().toLowerCase())
  @IsOptional()
  @IsIn(['all', 'active', 'inactive', 'opted_in', 'opted_out'])
  filter?: string;

  @Transform(({ value }) => String(value || 'recent').trim().toLowerCase())
  @IsOptional()
  @IsIn(['recent', 'name', 'offers', 'last_offer'])
  sort?: string;

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

export class CreateLoyaltyCustomerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @Transform(({ value }) =>
    value == null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toLowerCase(),
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  notes?: string;

  @Type(() => Boolean)
  @IsBoolean()
  marketingConsent!: boolean;
}

export class UpdateLoyaltyCustomerDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @Transform(({ value }) =>
    value == null || String(value).trim() === ''
      ? undefined
      : String(value).trim().toLowerCase(),
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  notes?: string;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @Transform(({ value }) =>
    value == null || value === ''
      ? undefined
      : String(value).trim().toUpperCase(),
  )
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class SendLoyaltyWhatsappDto {
  @Transform(({ value }) => String(value || '').trim().toUpperCase())
  @IsIn(['COUPON', 'DISCOUNT', 'SPECIAL_OFFER', 'CUSTOM_MESSAGE'])
  offerType!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  title?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  couponCode?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercent?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumOrderValue?: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  offerDescription?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  message?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class UpdateLoyaltyProgramDto {
  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;

  @IsObject()
  configuration!: Record<string, unknown>;
}
