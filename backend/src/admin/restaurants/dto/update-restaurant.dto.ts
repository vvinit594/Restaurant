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
import { IsHttpImageUrl } from '../../../common/validators/is-http-image-url';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function normalizeSlug({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export class UpdateRestaurantAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === ''
      ? undefined
      : String(value).trim().toLowerCase(),
  )
  @IsEmail({}, { message: 'Admin email must be a valid email address.' })
  email?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * Flat body matching Super Admin RestaurantDetailPage save payload.
 */
export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @Transform(normalizeSlug)
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Slug is required.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  logoUrl?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  coverImageUrl?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === ''
      ? undefined
      : String(value).trim().toLowerCase(),
  )
  @IsEmail({}, { message: 'Restaurant email must be a valid email address.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateRestaurantAdminDto)
  admin?: UpdateRestaurantAdminDto;
}
