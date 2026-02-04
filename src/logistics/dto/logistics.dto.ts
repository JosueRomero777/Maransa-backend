import { IsNumber, IsOptional, IsString, IsEnum, IsArray, IsDate } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoLogistica } from '@prisma/client';

export class CreateLogisticsDto {
  @IsNumber()
  @Type(() => Number)
  orderId: number;

  @IsOptional()
  @IsEnum(EstadoLogistica)
  estado?: EstadoLogistica;

  @IsOptional()
  @IsString()
  vehiculoAsignado?: string;

  @IsOptional()
  @IsString()
  choferAsignado?: string;

  @IsOptional()
  @IsString()
  recursosUtilizados?: string;

  @IsOptional()
  @IsString()
  ubicacionOrigen?: string;

  @IsOptional()
  @IsString()
  ubicacionDestino?: string;

  @IsOptional()
  @IsString()
  rutaPlanificada?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  origenLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  origenLng?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  destinoLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  destinoLng?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateLogisticsDto {
  @IsOptional()
  @IsString()
  vehiculoAsignado?: string;

  @IsOptional()
  @IsString()
  choferAsignado?: string;

  @IsOptional()
  @IsString()
  recursosUtilizados?: string;

  @IsOptional()
  @IsString()
  ubicacionOrigen?: string;

  @IsOptional()
  @IsString()
  ubicacionDestino?: string;

  @IsOptional()
  @IsString()
  rutaPlanificada?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  origenLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  origenLng?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  destinoLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  destinoLng?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  incidentes?: string;
}

export class LogisticsFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(EstadoLogistica)
  estado?: EstadoLogistica;

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

export class AssignVehicleDto {
  @IsString()
  vehiculoAsignado: string;

  @IsString()
  choferAsignado: string;

  @IsOptional()
  @IsString()
  recursosUtilizados?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  incidentes?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}