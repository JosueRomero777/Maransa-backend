import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFormulaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  @IsEnum(['compra', 'venta'])
  tipo: 'compra' | 'venta';

  @IsObject()
  factores: Record<string, any>;

  @IsString()
  algoritmo: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ventanaHistorica?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pesoTemporada?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pesoProveedor?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pesoTalla?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pesoMercado?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ajustePorVolumen?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ajustePorCalidad?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  margenSeguridad?: number;

  @IsOptional()
  @IsString()
  version?: string;
}