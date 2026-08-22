import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export class UpdateRestaurantProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  state?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  pincode?: string;

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
}
