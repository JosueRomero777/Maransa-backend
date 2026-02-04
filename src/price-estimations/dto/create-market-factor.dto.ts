import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMarketFactorDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  categoria: string;

  @IsNumber()
  @Type(() => Number)
  valor: number;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsDateString()
  validoHasta?: string;

  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  peso?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}