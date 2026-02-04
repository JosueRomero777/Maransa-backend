import { IsNumber, IsOptional, IsString, IsEnum, IsDate, IsDecimal } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoCosecha } from '@prisma/client';

export class CreateHarvestDto {
  @IsNumber()
  @Type(() => Number)
  orderId: number;

  @IsOptional()
  @IsEnum(EstadoCosecha)
  estado?: EstadoCosecha;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cantidadEstimada?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaEstimada?: Date;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateHarvestDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cantidadFinal?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaDefinitiva?: Date;

  @IsOptional()
  @IsString()
  calidadEsperada?: string;

  @IsOptional()
  @IsString()
  condicionesCosecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}

export class HarvestFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(EstadoCosecha)
  estado?: EstadoCosecha;

  @IsOptional()
  @Type(() => Number)
  assignedUserId?: number;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class DefineHarvestDto {
  @IsNumber()
  @Type(() => Number)
  cantidadFinal: number;

  @IsDate()
  @Type(() => Date)
  fechaDefinitiva: Date;

  @IsOptional()
  @IsString()
  calidadEsperada?: string;

  @IsOptional()
  @IsString()
  condicionesCosecha?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  temperaturaOptima?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tiempoMaximoTransporte?: number;

  @IsOptional()
  @IsString()
  requerimientosEspeciales?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}