import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  dishId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class CreatePublicOrderDto {
  @IsString()
  @MinLength(1)
  tableId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @Transform(({ value }) =>
    value == null || String(value).trim() === '' ? undefined : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;

  @Transform(({ value }) =>
    value == null || String(value).trim() === '' ? undefined : String(value).trim().slice(0, 500),
  )
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;
}
