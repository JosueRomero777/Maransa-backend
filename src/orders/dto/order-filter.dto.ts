import { IsOptional, IsEnum, IsInt, IsDateString, IsString } from 'class-validator';
import { EstadoPedido } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export class OrderFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  providerId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  packagerId?: number;

  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  includeRelations?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  withoutReception?: boolean = false;
}