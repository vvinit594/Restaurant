import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function normalizeSlug({ value }: { value: unknown }) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export class RestaurantBodyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Transform(normalizeSlug)
  @IsString()
  @MinLength(1, { message: 'Slug is required.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only.',
  })
  slug!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail({}, { message: 'Restaurant email must be a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(1)
  address!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  state?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  pincode?: string;
}

export class OwnerBodyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail({}, { message: 'Admin email must be a valid email address.' })
  email!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;
}

export class SubscriptionBodyDto {
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  planId?: string;
}

export class CreateRestaurantDto {
  @IsObject()
  @ValidateNested()
  @Type(() => RestaurantBodyDto)
  restaurant!: RestaurantBodyDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OwnerBodyDto)
  admin?: OwnerBodyDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OwnerBodyDto)
  owner?: OwnerBodyDto;

  @IsOptional()
  @IsString()
  subscriptionPlan?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionBodyDto)
  subscription?: SubscriptionBodyDto;
}
