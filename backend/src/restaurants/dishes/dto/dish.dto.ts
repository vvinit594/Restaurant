import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsHttpImageUrl } from '../../../common/validators/is-http-image-url';

/** Max dishes per bulk request — keeps JSON under 1mb body limit / serverless time. */
export const BULK_DISH_BATCH_MAX = 50;

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export class CreateDishDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Price must be greater than 0.' })
  price!: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  category?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbohydrates?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fat?: number;

  @IsOptional()
  ingredients?: string | string[];

  @IsOptional()
  allergens?: string | string[];

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isVegan?: boolean;

  @IsOptional()
  @IsBoolean()
  isJain?: boolean;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateDishDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price?: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  category?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbohydrates?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fat?: number;

  @IsOptional()
  ingredients?: string | string[];

  @IsOptional()
  allergens?: string | string[];

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isVegan?: boolean;

  @IsOptional()
  @IsBoolean()
  isJain?: boolean;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** One row for bulk validate/import. restaurantId must never come from client Excel. */
export class BulkDishItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  row?: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Price must be greater than 0.' })
  price!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsHttpImageUrl()
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carbohydrates?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fat?: number;

  @IsOptional()
  ingredients?: string | string[];

  @IsOptional()
  allergens?: string | string[];

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isVegan?: boolean;

  @IsOptional()
  @IsBoolean()
  isJain?: boolean;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class BulkDishesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_DISH_BATCH_MAX)
  @ValidateNested({ each: true })
  @Type(() => BulkDishItemDto)
  dishes!: BulkDishItemDto[];
}
